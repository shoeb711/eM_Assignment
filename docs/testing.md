# Testing

## Automated checks (`cd server && npm test`)
Vitest + Supertest call the real Express app against a **separate PostgreSQL database** (`pmo_portal_test`), which
`tests/globalSetup.js` drops, re-creates, migrates and seeds before every run. Demo data is never touched.

| # | Test | Proves |
|---|---|---|
| 1 | Contributor calling the approval API directly → 403 | Server-side RBAC (acceptance D) |
| 2 | Contributor calling the cost-posting API directly → 403 | Server-side RBAC (acceptance D) |
| 3 | Non-member project → 404 | Scoped access, no ID escalation |
| 4 | Nobody can approve their own change request | Self-approval prevention |
| 5 | Approval writes exactly one history row; APPROVED → REJECTED → 409 | Transaction + workflow (acceptance C) |
| 6 | Transition table allows only documented changes | Workflow rules (unit test) |
| 7 | PRJ-002 budget / actual / remaining / utilization / EAC / variance exact values | Financial formulas |
| 8 | Draft cost ignored until posted; second post → 409 | Draft vs posted, double-submit protection |
| 9 | Automation: second run creates 0 alerts; simulated failure → FAILED then SUCCESS | Duplicate protection + retry |
| 10 | Only an admin can trigger the automation | RBAC on automation |

**Validation of the tests themselves:** the permission check in `utils/access.js` was deliberately broken (`return true`);
tests 1, 2 and 7 failed as expected; after restoring the code all 10 passed again.

Additional checks used during development (not part of `npm test`): a 49-step API smoke run covering all business journeys,
and browser runs (Playwright) of the six journeys and the dashboard integrity checks.

## Manual end-to-end checklist (live acceptance tests)
Start from a clean baseline: `cd server && npm run db:import`. Password for all users: `Demo@123`.

| ID | Steps | Expected |
|---|---|---|
| **A** End-to-end persistence | Priya → Projects → **+ New project** (any data) → open it → Tasks → **+ Add task** → set progress 40% → Save → **reload the browser** | Project and task still there with 40%; `docker exec -it eminds-postgres psql -U pmo -d pmo_portal -c "SELECT title, progress FROM tasks ORDER BY id DESC LIMIT 1;"` shows the same |
| **B** Finance mutation | Priya → PRJ-002 → Finance → **+ Add cost** (date ≤ 30 Sep 2026, *Post immediately*) → confirm → click *See the transactions behind "Actual spend"* | Actual spend, remaining, utilization change; drill-down total equals Actual spend |
| **C** Approval transaction | Chen → PRJ-002 → Change requests → submit. Priya → Change requests → open it → Approve with a reason | Status Approved; history shows exactly 2 entries (Submitted, Approved) |
| **D** Authorization denial | Postman → import `docs/postman_collection.json` → run folder 1 | Post cost → 403, approve → 403, other project → 404 |
| **E** Dashboard integrity | Dashboard → note *Overdue tasks* → open an overdue task → set Done → back to Dashboard | KPI dropped by 1; drill-down count = KPI; same value with `docs/sql/report-queries.sql` query 5 |
| **F** Analytics agreement | Compare `docs/kpi-reconciliation.md` (SQL vs web dashboard) | 4 KPIs identical (Power BI not delivered) |
| **G** Automation | Layla → Audit & automation → Automation runs → tick *Simulate a failure* → **Run now** | New rows: attempt 1 Failed (error shown), attempt 2 Success; no duplicate alerts |
| **H** Engineering quality | `cd server && npm test`; open `server/logs/app.log` | 10 passed; JSON log lines with request IDs (errors include stack trace) |

## Concurrency check
Open the same task in two browser windows (two users or one user twice) → save in window 1 → save in window 2
→ window 2 shows *"This record was changed by someone else since you opened it. Please reload and try again."* (HTTP 409).
