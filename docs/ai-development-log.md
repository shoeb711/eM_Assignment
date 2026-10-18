# AI Development Log

**Tool used:** Claude (Anthropic), as a pair-programmer working in phases, with me (Shoeb) deciding the scope, stack and
trade-offs, running everything on my own machine, and reviewing/validating each phase before committing it.
Each phase is one Git commit, so the history shows how the solution was built step by step.

## How I used AI (prompt strategy)
1. **Requirements first, code second.** I first asked the AI to summarise the assignment in plain language and turn it into
   phases with a "done when" check for each, then confirmed the stack myself (React + Express + PostgreSQL, JavaScript, Tailwind,
   local Docker database, no Power BI).
2. **Constrain for explainability.** Standing instruction for every phase: *"build it easy to read and explain - small files,
   one job per file, business rules in one obvious place, comments on the 'why'"*.
3. **Rules as explicit specifications.** For finance and workflow I gave the exact definitions from the brief (approved revisions
   only, posted costs to the cutoff, EAC = actual + forecast, allowed transitions, no self-approval) and asked for them to be
   enforced on the server **and** in the database where possible.
4. **Verify, don't trust.** Every phase had to be run against a real PostgreSQL database before I received it, then I ran it
   locally (Postman, browser, `npm test`). Numbers on the dashboard were reconciled against hand-written SQL.
5. **Ask for the failure cases.** I asked for edge cases in the data (overdue, due today, unassigned, closed high risk,
   draft vs posted, after-cutoff costs, no forecast) so wrong logic would show up as wrong numbers.

## Iterations

### 1. Database access layer - ORM rejected after verification
| | |
|---|---|
| **Requirement** | Relational SQL database with migrations, parameterized queries, transactions, explainable SQL. |
| **Prompt** | "Set up the project skeleton: Docker Postgres, Express API, React + Tailwind. Use Prisma for migrations and queries." |
| **AI result** | A Prisma setup. When the AI tried to run it, the Prisma engine binary download was blocked in its test environment, so the code could not be verified before reaching me. |
| **Decision** | **Rejected Prisma.** Switched to the `pg` library with numbered `.sql` migration files and a small migration runner. |
| **Why** | Every query can be tested against real PostgreSQL; the SQL the assessors want to see is visible instead of hidden behind ORM syntax; fewer moving parts to explain. |
| **Evidence** | `server/db.js` (`query`, `withTransaction`), `server/scripts/migrate.js`, migration `001_init.sql`; health check returned `database: connected` on my machine. |

### 2. List filters - AI-generated SQL placeholder bug (AI was wrong)
| | |
|---|---|
| **Requirement** | Project list search by name **or** code, combined with other filters and the user's access scope. |
| **Prompt** | "Add search, department, owner, status and date filters to the projects list, with pagination and safe sorting." |
| **AI result** | `filters.add('(p.name ILIKE ? OR p.code ILIKE $2)', …)` - the second placeholder was **hard-coded as `$2`**. |
| **Problem found** | Caught in code review before running: for a non-admin user the access-scope filter is added first, so the search value is not `$2` → the query would compare the code with the wrong parameter (wrong results or a type error). |
| **Fix** | Changed the filter helper so every `?` in one condition becomes the **same** generated placeholder (`replaceAll`), and wrote the search as `(p.name ILIKE ? OR p.code ILIKE ?)`. |
| **Evidence** | `server/src/utils/listQuery.js`; smoke test "Search by name" and contributor-scoped project list both pass. |

### 3. Task edit form would silently wipe descriptions (AI was wrong)
| | |
|---|---|
| **Requirement** | Project managers edit any task field; assignees update status/progress only. |
| **Prompt** | "Build the task create/edit modal; manager gets all fields, assignee only status and progress." |
| **AI result** | The modal pre-filled from the task **list** row, but the list API did not return `description`, so saving a task would have sent an empty description - **silent data loss**. |
| **Problem found** | Noticed while wiring the edit form to the list data (comparing the fields the form reads with the columns the SQL selects). |
| **Fix** | Added `t.description` to the task list query; kept the server rule that a contributor can only send `status`, `progress`, `version` (`.strict()` schema rejects anything else). |
| **Evidence** | `taskService.listTasks`; browser test "Assignee sees progress-only form (title locked)" + manager edit preserves description. |

### 4. Dashboard KPIs - designing against join inflation
| | |
|---|---|
| **Requirement** | Live KPIs from SQL with 4+ filters and drill-downs that add up; "avoid inflating budget or spend through incorrect joins". |
| **Prompt** | "Build GET /api/dashboard. Every KPI must come from SQL, respect department/project/manager/status filters and the user's access, and never join tasks, risks and costs together before aggregating. Drill-down lists must accept the same filters." |
| **AI result** | A "scope" CTE (filtered, access-checked project ids) + one aggregate per table; finance via a shared query that pre-aggregates revisions, costs and forecasts per project. |
| **Problem found** | PostgreSQL rejects a query when a passed parameter is never used ("could not determine data type of parameter $1"); some KPI queries did not need the reporting date. |
| **Fix** | Every dashboard query starts with `WITH as_of AS (SELECT $1::date AS d)`, which types `$1` once and gives every query a readable name for the reporting date. |
| **Evidence** | `dashboardService.js`; `docs/kpi-reconciliation.md` - 4 KPIs identical between hand-written SQL and the API, unfiltered and filtered by department; browser test: after completing a task the overdue KPI went 3 → 2, after posting AED 100,000 actual spend went 3.79M → 3.89M. |

### 5. Charts rendered at the wrong width (AI was wrong)
| | |
|---|---|
| **Requirement** | Responsive charts. |
| **AI result** | Recharts `ResponsiveContainer` inside a CSS grid card - charts rendered squeezed (~250 px) in a 540 px card, hiding most project labels. |
| **Problem found** | Visible in the screenshot review of the dashboard. |
| **Fix** | `min-w-0` on the grid item and chart container (a grid item otherwise refuses to shrink/measure correctly), `grid-cols-1` on mobile, all x-axis labels forced, top margin so the "Reporting date" label is not clipped; bar animation turned off so refetches don't flash. Also fixed low-contrast white numbers on light risk-matrix cells. |
| **Evidence** | Measured chart widths 542 / 1134 px after the fix; screenshot in the submission. |

### 6. "All statuses" filter silently went back to the default (AI was wrong)
| | |
|---|---|
| **Requirement** | Change-request page defaults to the approval queue (SUBMITTED) but can show all. |
| **AI result** | Selecting "All statuses" set the URL value to empty, and the page's default immediately put SUBMITTED back - the option did nothing. |
| **Fix** | Use an explicit `ALL` value in the URL, translated to "no status filter" before calling the API. |
| **Evidence** | `ChangeRequestsPage.jsx`. |

### 7. Proving the tests actually test something
| | |
|---|---|
| **Requirement** | ≥ 5 executable checks across RBAC, finance and workflow. |
| **Prompt** | "Write Vitest + Supertest tests against a separate test database for: contributor denied approval and posting, self-approval, one history row per decision, finance formulas for PRJ-002, drafts excluded, automation dedupe and retry." |
| **AI result** | 10 tests, all passing. |
| **Validation** | Deliberately broke the permission rule (`canManageProject` → `return true`). Tests 1, 2 and the finance test failed (the illegal posted cost changed the totals). Restored → 10/10 pass. |
| **Evidence** | `server/tests/api.test.js`; `npm test` → 10 passed on my machine. |

## Where AI was used, and what I validated
| Area | AI-assisted | What I validated / decided myself |
|---|---|---|
| Requirements breakdown & plan | Yes | Chose scope (Assignment 1 first; Power BI and Access skipped), stack, phases |
| Database schema, seed generator | Yes | Ran migrations + seed locally; checked row counts and edge cases; CSVs identical on re-run |
| API (auth, RBAC, workflows, finance) | Yes | Ran the Postman collection: contributor gets 403 on approval and cost posting, 404 on other projects |
| Frontend | Yes | Ran every journey in the browser (create project, update task, post cost, approve change request) |
| Dashboard | Yes | Compared KPI values with hand-written SQL (`docs/kpi-reconciliation.md`); checked drill-down totals |
| Automation & tests | Yes | `npm test` 10/10; demoed simulated failure → retry in the UI |
| Documentation | Yes | Reviewed for accuracy against the running system |

Every file in the repository was generated or edited with AI assistance and reviewed by me; none was accepted without being
run against the real database.