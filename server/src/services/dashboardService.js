// =====================================================================
// Executive dashboard - every number is calculated here, in SQL, from the
// transactional tables. The browser only displays what this returns.
// ---------------------------------------------------------------------
// How filtering works:
//   1. "scope" = the ids of projects that match the filters (department, project,
//      manager, lifecycle status) AND that the user is allowed to see.
//   2. Every KPI is a SEPARATE aggregate over ONE table (tasks, risks, costs, ...)
//      restricted to "project_id IN scope". Tables are never joined to each other
//      before summing, so one project's 9 tasks can't multiply its costs (no
//      inflated totals from joining several one-to-many tables).
//
// Every query starts with the same WITH block:
//   as_of = the reporting date ($1)          scope = matching project ids
// =====================================================================
import { query } from '../db.js';
import { config } from '../config.js';
import { createFilters } from '../utils/listQuery.js';
import { addProjectScope } from '../utils/access.js';
import { PROJECT_FINANCIALS_SQL } from '../sql/projectFinancials.js';

// Project health rule (documented so it can be explained and changed in one place):
//   RED   = forecast overrun (EAC > budget) OR 3+ overdue tasks
//   AMBER = 90%+ of budget used OR any overdue task OR any open high-exposure risk
//   GREEN = none of the above;  CLOSED = completed or cancelled project
const HEALTH_SQL = `
  CASE WHEN f.status IN ('COMPLETED', 'CANCELLED') THEN 'CLOSED'
       WHEN f.projected_variance < 0 OR d.overdue_tasks >= 3 THEN 'RED'
       WHEN f.utilization_pct >= 90 OR d.overdue_tasks > 0 OR d.high_risks > 0 THEN 'AMBER'
       ELSE 'GREEN' END`;

function buildScope(user, filters) {
  const f = createFilters();
  f.param(filters.asOf); // $1 = reporting date (used by every query through the as_of CTE)
  addProjectScope(f, user, 'p.id');
  if (filters.departmentId) f.add('p.department_id = ?', filters.departmentId);
  if (filters.projectId) f.add('p.id = ?', filters.projectId);
  if (filters.managerId) f.add('p.owner_id = ?', filters.managerId);
  if (filters.status) f.add('p.status = ?', filters.status);
  return {
    params: f.params,
    withSql: `WITH as_of AS (SELECT $1::date AS d),
                   scope AS (SELECT p.id FROM projects p ${f.where()})`,
  };
}

// Runs "WITH as_of, scope ... <sql>". extra values become $n placeholders after the scope ones.
function run(scope, buildSql, extra = []) {
  const placeholders = extra.map((_, i) => `$${scope.params.length + i + 1}`);
  return query(`${scope.withSql} ${buildSql(...placeholders)}`, [...scope.params, ...extra]);
}

export async function getDashboard(user, filters) {
  const asOf = config.reportingDate;
  // Period for the trend / category charts. "to" can never go past the reporting date.
  const periodFrom = filters.from || '2025-10-01';
  const periodTo = filters.to && filters.to < asOf ? filters.to : asOf;
  const scope = buildScope(user, { ...filters, asOf });

  const [delivery, finance, projects, monthly, categories, overdueByOwner, riskMatrix, milestones] = await Promise.all([
    // ---------- Delivery, risk & governance KPIs (each sub-select reads ONE table) ----------
    run(scope, () => `
      SELECT
        (SELECT COUNT(*) FROM projects WHERE id IN (SELECT id FROM scope))                         AS total_projects,
        (SELECT COUNT(*) FROM projects WHERE id IN (SELECT id FROM scope) AND status = 'ACTIVE')    AS active_projects,
        t.total_tasks, t.done_tasks, t.progress_pct, t.overdue_tasks, t.blocked_tasks,
        (SELECT COUNT(*) FROM milestones m
          WHERE m.project_id IN (SELECT id FROM scope) AND m.status <> 'ACHIEVED'
            AND m.due_date > (SELECT d FROM as_of) AND m.due_date <= (SELECT d FROM as_of) + 14)   AS milestones_due_14d,
        (SELECT COUNT(*) FROM risks r
          WHERE r.project_id IN (SELECT id FROM scope) AND r.status <> 'CLOSED' AND r.score >= ${config.highRiskScore}) AS open_high_risks,
        (SELECT COUNT(*) FROM change_requests c
          WHERE c.project_id IN (SELECT id FROM scope) AND c.status = 'SUBMITTED')                AS pending_change_requests
      FROM (
        SELECT COUNT(*)                                                         AS total_tasks,
               COUNT(*) FILTER (WHERE status = 'DONE')                          AS done_tasks,
               ROUND(SUM(weight * progress)::numeric / NULLIF(SUM(weight), 0), 1) AS progress_pct,
               COUNT(*) FILTER (WHERE status <> 'DONE' AND due_date < (SELECT d FROM as_of)) AS overdue_tasks,
               COUNT(*) FILTER (WHERE status = 'BLOCKED')                       AS blocked_tasks
          FROM tasks WHERE project_id IN (SELECT id FROM scope)
      ) t`),

    // ---------- Financial KPIs: sum of the per-project financial rows ----------
    run(scope, () => `
      SELECT COALESCE(SUM(current_budget), 0)       AS approved_budget,
             COALESCE(SUM(actual_spend), 0)         AS actual_spend,
             COALESCE(SUM(remaining_budget), 0)     AS remaining_budget,
             CASE WHEN SUM(current_budget) > 0
                  THEN ROUND(100 * SUM(actual_spend) / SUM(current_budget), 1) END AS utilization_pct,
             COALESCE(SUM(forecast_to_complete), 0) AS forecast_to_complete,
             COALESCE(SUM(eac), 0)                  AS eac,
             COUNT(*) FILTER (WHERE projected_variance < 0)                    AS overrun_projects,
             COALESCE(SUM(-projected_variance) FILTER (WHERE projected_variance < 0), 0) AS overrun_amount,
             COUNT(*) FILTER (WHERE forecast_missing)                          AS projects_missing_forecast
        FROM (${PROJECT_FINANCIALS_SQL}) fin
       WHERE fin.project_id IN (SELECT id FROM scope)`),

    // ---------- One row per project: health + budget vs actual vs EAC ----------
    run(scope, () => `
      SELECT f.project_id, f.code, f.name, f.status, f.current_budget, f.actual_spend, f.eac,
             f.projected_variance, f.utilization_pct, f.forecast_missing,
             d.overdue_tasks, d.high_risks, d.progress_pct,
             ${HEALTH_SQL} AS health
        FROM (${PROJECT_FINANCIALS_SQL}) f
        JOIN LATERAL (
          SELECT (SELECT COUNT(*) FROM tasks t WHERE t.project_id = f.project_id AND t.status <> 'DONE' AND t.due_date < (SELECT d FROM as_of)) AS overdue_tasks,
                 (SELECT COUNT(*) FROM risks r WHERE r.project_id = f.project_id AND r.status <> 'CLOSED' AND r.score >= ${config.highRiskScore}) AS high_risks,
                 (SELECT ROUND(SUM(t.weight * t.progress)::numeric / NULLIF(SUM(t.weight), 0), 1) FROM tasks t WHERE t.project_id = f.project_id) AS progress_pct
        ) d ON TRUE
       WHERE f.project_id IN (SELECT id FROM scope)
       ORDER BY f.code`),

    // ---------- Monthly trend: posted spend per month in the period + future forecast ----------
    run(scope, (from, to, category) => `
      SELECT to_char(m.month, 'YYYY-MM') AS month, COALESCE(a.actual, 0) AS actual, COALESCE(fc.forecast, 0) AS forecast
        -- one row per month: from the period start to the later of (period end, last forecast month)
        FROM (SELECT generate_series(
                       date_trunc('month', ${from}::date),
                       GREATEST(date_trunc('month', ${to}::date),
                                COALESCE((SELECT MAX(month) FROM financial_forecasts WHERE project_id IN (SELECT id FROM scope)), ${to}::date)),
                       interval '1 month')::date AS month) m
        LEFT JOIN (SELECT date_trunc('month', txn_date)::date AS month, SUM(amount) AS actual
                     FROM cost_transactions
                    WHERE project_id IN (SELECT id FROM scope) AND status = 'POSTED'
                      AND txn_date BETWEEN ${from}::date AND ${to}::date
                      AND (${category}::int IS NULL OR category_id = ${category}::int)
                    GROUP BY 1) a ON a.month = m.month
        LEFT JOIN (SELECT month, SUM(amount) AS forecast
                     FROM financial_forecasts
                    WHERE project_id IN (SELECT id FROM scope) AND month > date_trunc('month', (SELECT d FROM as_of))
                      AND ${category}::int IS NULL          -- forecasts have no category
                    GROUP BY 1) fc ON fc.month = m.month
       ORDER BY m.month`, [periodFrom, periodTo, filters.categoryId ?? null]),

    // ---------- Spend by category (posted, in the period) ----------
    run(scope, (from, to, category) => `
      SELECT c.id AS category_id, c.name AS category, COALESCE(SUM(t.amount), 0) AS amount
        FROM cost_categories c
        LEFT JOIN cost_transactions t
               ON t.category_id = c.id AND t.status = 'POSTED'
              AND t.project_id IN (SELECT id FROM scope)
              AND t.txn_date BETWEEN ${from}::date AND ${to}::date
       WHERE (${category}::int IS NULL OR c.id = ${category}::int)
       GROUP BY c.id, c.name
       ORDER BY amount DESC`, [periodFrom, periodTo, filters.categoryId ?? null]),

    // ---------- Overdue incomplete tasks by assignee ----------
    run(scope, () => `
      SELECT t.assignee_id, COALESCE(u.full_name, 'Unassigned') AS owner, COUNT(*) AS overdue_tasks
        FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id IN (SELECT id FROM scope) AND t.status <> 'DONE' AND t.due_date < (SELECT d FROM as_of)
       GROUP BY t.assignee_id, u.full_name
       ORDER BY overdue_tasks DESC, owner`),

    // ---------- Risk matrix: open risks/issues by probability x impact ----------
    run(scope, () => `
      SELECT probability, impact, COUNT(*) AS count
        FROM risks
       WHERE project_id IN (SELECT id FROM scope) AND status <> 'CLOSED'
       GROUP BY probability, impact`),

    // ---------- Milestone roadmap: late + due in the next 45 days ----------
    run(scope, () => `
      SELECT m.id, m.name, m.due_date, m.status, p.id AS project_id, p.code AS project_code,
             (m.due_date < (SELECT d FROM as_of)) AS is_late
        FROM milestones m JOIN projects p ON p.id = m.project_id
       WHERE m.project_id IN (SELECT id FROM scope) AND m.status NOT IN ('ACHIEVED')
         AND m.due_date <= (SELECT d FROM as_of) + 45
       ORDER BY m.due_date
       LIMIT 12`),
  ]);

  return {
    asOf,
    period: { from: periodFrom, to: periodTo },
    filters,
    kpis: { ...delivery.rows[0], ...finance.rows[0] },
    projects: projects.rows,
    monthly: monthly.rows,
    spendByCategory: categories.rows,
    overdueByOwner: overdueByOwner.rows,
    riskMatrix: riskMatrix.rows,
    milestones: milestones.rows,
  };
}
