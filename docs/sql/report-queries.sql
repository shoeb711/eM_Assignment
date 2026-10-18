-- =====================================================================
-- Practical reporting queries (Assignment Section 7)
-- Run against the seeded database, e.g.:
--   docker exec -i eminds-postgres psql -U pmo -d pmo_portal < docs/sql/report-queries.sql
-- All queries use the fixed reporting date 30 Sep 2026 (in production: CURRENT_DATE).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) OVERDUE TASKS
-- A task is overdue when it is NOT done and its due date is BEFORE the reporting date.
-- (A task due exactly on the reporting date is "due today", not overdue.)
-- ---------------------------------------------------------------------
SELECT p.code                                   AS project,
       t.title                                  AS task,
       COALESCE(u.full_name, '(unassigned)')    AS assignee,
       t.status,
       t.priority,
       t.due_date,
       DATE '2026-09-30' - t.due_date           AS days_overdue,
       t.progress                               AS progress_pct
  FROM tasks t
  JOIN projects p   ON p.id = t.project_id
  LEFT JOIN users u ON u.id = t.assignee_id     -- LEFT JOIN keeps unassigned tasks
 WHERE t.status <> 'DONE'
   AND t.due_date < DATE '2026-09-30'
 ORDER BY days_overdue DESC, p.code;


-- ---------------------------------------------------------------------
-- 2) PROJECT FINANCIAL PERFORMANCE
-- Each one-to-many table (revisions, costs, forecasts) is first reduced to ONE row per
-- project in its own sub-query, and only then joined. Joining the raw tables together
-- would multiply rows (e.g. 3 revisions x 20 costs = 60 rows) and inflate every SUM.
-- ---------------------------------------------------------------------
SELECT p.code,
       p.name,
       p.status,
       p.initial_budget,
       COALESCE(rev.approved, 0)                                      AS approved_revisions,
       p.initial_budget + COALESCE(rev.approved, 0)                   AS current_budget,
       COALESCE(act.actual, 0)                                        AS actual_spend,
       p.initial_budget + COALESCE(rev.approved, 0) - COALESCE(act.actual, 0) AS remaining_budget,
       ROUND(100 * COALESCE(act.actual, 0)
             / NULLIF(p.initial_budget + COALESCE(rev.approved, 0), 0), 1)    AS utilization_pct,
       CASE WHEN p.status IN ('COMPLETED', 'CANCELLED') THEN 0
            ELSE COALESCE(fc.ftc, 0) END                              AS forecast_to_complete,
       COALESCE(act.actual, 0)
         + CASE WHEN p.status IN ('COMPLETED', 'CANCELLED') THEN 0 ELSE COALESCE(fc.ftc, 0) END AS eac,
       (p.initial_budget + COALESCE(rev.approved, 0))
         - (COALESCE(act.actual, 0)
            + CASE WHEN p.status IN ('COMPLETED', 'CANCELLED') THEN 0 ELSE COALESCE(fc.ftc, 0) END) AS projected_variance
  FROM projects p
  LEFT JOIN (SELECT project_id, SUM(amount) AS approved
               FROM budget_revisions WHERE status = 'APPROVED'
              GROUP BY project_id) rev ON rev.project_id = p.id
  LEFT JOIN (SELECT project_id, SUM(amount) AS actual
               FROM cost_transactions WHERE status = 'POSTED' AND txn_date <= DATE '2026-09-30'
              GROUP BY project_id) act ON act.project_id = p.id
  LEFT JOIN (SELECT project_id, SUM(amount) AS ftc
               FROM financial_forecasts WHERE month > DATE '2026-09-01'
              GROUP BY project_id) fc ON fc.project_id = p.id
 ORDER BY projected_variance;


-- ---------------------------------------------------------------------
-- 3) HIGH-EXPOSURE OPEN RISKS & ISSUES
-- score = probability x impact (a generated column). High exposure = score >= 15.
-- CLOSED items are excluded even if their score is high.
-- ---------------------------------------------------------------------
SELECT p.code             AS project,
       r.type,
       r.title,
       r.probability,
       r.impact,
       r.score,
       r.status,
       COALESCE(u.full_name, '(no owner)') AS owner,
       r.due_date,
       r.mitigation
  FROM risks r
  JOIN projects p   ON p.id = r.project_id
  LEFT JOIN users u ON u.id = r.owner_id
 WHERE r.status <> 'CLOSED'
   AND r.score >= 15
 ORDER BY r.score DESC, p.code;


-- ---------------------------------------------------------------------
-- 4a) MONTHLY SPEND (actual) AND FORECAST
-- Actual = posted costs per month up to the reporting date; forecast = future months.
-- ---------------------------------------------------------------------
SELECT to_char(m.month, 'YYYY-MM')      AS month,
       COALESCE(a.actual, 0)             AS actual_spend,
       COALESCE(f.forecast, 0)           AS forecast
  FROM (SELECT DISTINCT date_trunc('month', txn_date)::date AS month
          FROM cost_transactions WHERE status = 'POSTED' AND txn_date <= DATE '2026-09-30'
        UNION
        SELECT month FROM financial_forecasts WHERE month > DATE '2026-09-01') m
  LEFT JOIN (SELECT date_trunc('month', txn_date)::date AS month, SUM(amount) AS actual
               FROM cost_transactions
              WHERE status = 'POSTED' AND txn_date <= DATE '2026-09-30'
              GROUP BY 1) a ON a.month = m.month
  LEFT JOIN (SELECT month, SUM(amount) AS forecast
               FROM financial_forecasts WHERE month > DATE '2026-09-01'
              GROUP BY month) f ON f.month = m.month
 ORDER BY m.month;


-- ---------------------------------------------------------------------
-- 4b) MILESTONE STATUS
-- Late = not achieved and due before the reporting date; due soon = within the next 14 days.
-- ---------------------------------------------------------------------
SELECT p.code AS project,
       m.name AS milestone,
       m.due_date,
       m.status,
       CASE
         WHEN m.status = 'ACHIEVED'                                   THEN 'Achieved'
         WHEN m.due_date <  DATE '2026-09-30'                          THEN 'Late'
         WHEN m.due_date <= DATE '2026-09-30' + 14                     THEN 'Due within 14 days'
         ELSE 'Upcoming'
       END AS delivery_flag
  FROM milestones m
  JOIN projects p ON p.id = m.project_id
 ORDER BY m.due_date;


-- ---------------------------------------------------------------------
-- 5) KPI RECONCILIATION - the same four KPIs the web dashboard shows (all projects)
-- Compare with GET /api/dashboard (admin, no filters). See docs/kpi-reconciliation.md.
-- ---------------------------------------------------------------------
SELECT
  (SELECT SUM(amount) FROM cost_transactions
    WHERE status = 'POSTED' AND txn_date <= DATE '2026-09-30')                          AS actual_spend,
  (SELECT SUM(initial_budget) FROM projects)
    + (SELECT COALESCE(SUM(amount), 0) FROM budget_revisions WHERE status = 'APPROVED') AS approved_budget,
  (SELECT COUNT(*) FROM tasks WHERE status <> 'DONE' AND due_date < DATE '2026-09-30')  AS overdue_tasks,
  (SELECT COUNT(*) FROM risks WHERE status <> 'CLOSED' AND score >= 15)                 AS open_high_risks;
