# KPI reconciliation

The assignment asks to reconcile four KPIs across **SQL**, the **web dashboard** and **Power BI**.
Power BI was **not delivered** (see README, "Scope notes"), so this note reconciles the two systems that exist:
an independent SQL query written by hand (`docs/sql/report-queries.sql`, query 5) and the web dashboard
(`GET /api/dashboard`, the numbers shown on the Dashboard page).

Snapshot: **30 Sep 2026**, freshly seeded data (`npm run db:import`), signed in as the Administrator (sees all projects).

## All projects (no filters)

| KPI | Independent SQL | Web dashboard (API) | Match |
|---|---|---|---|
| Actual spend (posted costs ≤ 30 Sep 2026) | AED 6,026,500.00 | AED 6,026,500 (card shows "AED 6.03M") | ✅ |
| Approved budget (initial + approved revisions) | AED 10,500,000.00 | AED 10,500,000 ("AED 10.50M") | ✅ |
| Overdue incomplete tasks | 15 | 15 | ✅ |
| Open high-exposure risks (score ≥ 15, not closed) | 8 | 8 | ✅ |

## Filtered: Department = Network Operations

| KPI | Independent SQL | Web dashboard (API) | Match |
|---|---|---|---|
| Actual spend | AED 554,500.00 | AED 554,500 | ✅ |
| Approved budget | AED 1,750,000.00 | AED 1,750,000 | ✅ |
| Overdue incomplete tasks | 8 | 8 | ✅ |
| Open high-exposure risks | 2 | 2 | ✅ |

## Drill-down cross-check
- Clicking **Actual spend** opens `/costs?status=POSTED&to=2026-09-30`; the list's server-calculated total is **AED 6,026,500.00** (114 transactions).
- Clicking **Overdue incomplete tasks** opens `/tasks?overdue=true` and lists **15** tasks; with the department filter it lists **8**.

## Why the numbers can differ (and how they are avoided)

| Possible discrepancy | How this solution handles it |
|---|---|
| Draft costs counted as spend | Only `status = 'POSTED'` is summed. |
| Costs dated after the reporting date | `txn_date <= reporting date` on every actual-spend calculation. |
| Pending / rejected budget revisions | Only `status = 'APPROVED'` revisions change the budget. |
| Inflated totals from joining tasks, risks and costs | Each KPI is aggregated from one table at a time inside a project "scope"; the project financial query pre-aggregates each one-to-many table before joining. |
| A task due exactly on the reporting date | Treated as *due today*, not overdue (`due_date < reporting date`). |
| Rounding | Money is `NUMERIC(14,2)` in the database; only the KPI *cards* abbreviate (6.03M) - drill-downs and "View as table" show exact values. |
| Different user scope | The dashboard only counts projects the signed-in user may see; the reconciliation above uses the Administrator (all projects). |
