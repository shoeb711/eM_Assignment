// =====================================================================
// THE financial formulas - one SQL query used by the project finance page
// AND the executive dashboard, so both always show the same numbers.
// ---------------------------------------------------------------------
//   current approved budget = initial budget + APPROVED budget revisions only
//   actual spend            = POSTED costs dated on/before the reporting date (drafts excluded)
//   remaining budget        = current approved budget - actual spend
//   utilization %           = actual spend / current approved budget  (NULL when budget is 0)
//   forecast to complete    = monthly forecasts for months AFTER the reporting month
//                             (0 for COMPLETED/CANCELLED projects - nothing left to spend)
//   EAC                     = actual spend + forecast to complete
//   projected variance      = current approved budget - EAC   (negative = forecast overrun)
//
// Why sub-queries instead of joining everything together:
// a project has MANY revisions, MANY costs and MANY forecast months. Joining those three
// tables directly would multiply rows (3 revisions x 20 costs = 60 rows) and inflate the sums.
// Each sub-query first reduces its table to ONE row per project, then they are joined safely.
//
// $1 = reporting date ('YYYY-MM-DD')
// =====================================================================
export const PROJECT_FINANCIALS_SQL = `
  SELECT f.*,
         f.current_budget - f.actual_spend                                   AS remaining_budget,
         CASE WHEN f.current_budget > 0
              THEN ROUND(100 * f.actual_spend / f.current_budget, 1) END      AS utilization_pct,
         f.actual_spend + f.forecast_to_complete                             AS eac,
         f.current_budget - (f.actual_spend + f.forecast_to_complete)        AS projected_variance
    FROM (
      SELECT p.id AS project_id, p.code, p.name, p.status, p.department_id, p.owner_id,
             p.initial_budget,
             COALESCE(rev.approved_total, 0)                     AS approved_revisions,
             p.initial_budget + COALESCE(rev.approved_total, 0)  AS current_budget,
             COALESCE(act.actual_spend, 0)                       AS actual_spend,
             CASE WHEN p.status IN ('COMPLETED', 'CANCELLED') THEN 0
                  ELSE COALESCE(fc.forecast_total, 0) END        AS forecast_to_complete,
             -- an open project with no future forecast months is flagged, not silently treated as "on budget"
             (fc.project_id IS NULL AND p.status NOT IN ('COMPLETED', 'CANCELLED')) AS forecast_missing
        FROM projects p
        LEFT JOIN (SELECT project_id, SUM(amount) AS approved_total
                     FROM budget_revisions
                    WHERE status = 'APPROVED'
                    GROUP BY project_id) rev ON rev.project_id = p.id
        LEFT JOIN (SELECT project_id, SUM(amount) AS actual_spend
                     FROM cost_transactions
                    WHERE status = 'POSTED' AND txn_date <= $1::date
                    GROUP BY project_id) act ON act.project_id = p.id
        LEFT JOIN (SELECT project_id, SUM(amount) AS forecast_total
                     FROM financial_forecasts
                    WHERE month > date_trunc('month', $1::date)
                    GROUP BY project_id) fc ON fc.project_id = p.id
    ) f
`;

// Budget alerts derived from one project's financial row.
export function budgetAlerts(row) {
  const alerts = [];
  if (row.actual_spend > row.current_budget) alerts.push({ type: 'OVERSPENT', message: 'Actual spend exceeds the approved budget.' });
  if (row.projected_variance < 0) alerts.push({ type: 'FORECAST_OVERRUN', message: 'Forecast (EAC) exceeds the approved budget.' });
  if (row.utilization_pct !== null && row.utilization_pct >= 90 && row.actual_spend <= row.current_budget) {
    alerts.push({ type: 'NEARING_BUDGET', message: `${row.utilization_pct}% of the approved budget is already spent.` });
  }
  if (row.forecast_missing) alerts.push({ type: 'FORECAST_MISSING', message: 'No forecast entered - EAC equals actual spend only.' });
  return alerts;
}
