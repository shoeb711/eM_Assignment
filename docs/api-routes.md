# API route list

Base URL (local): `http://localhost:4000/api` — the React app calls it through the Vite proxy at `http://localhost:5173/api`.

All routes except `/health` and `/auth/login` require the session cookie set by `/auth/login`.
Errors always have the same shape:

```json
{ "error": { "code": "FORBIDDEN", "message": "Only the project manager who owns this project, or an administrator, can do this.", "details": null, "requestId": "6b72…" } }
```

| Status | Meaning |
|---|---|
| 400 | Validation failed (`details` lists each field) or a business rule was broken |
| 401 | Not signed in / session expired |
| 403 | Signed in, but your role or relationship to the project does not allow this |
| 404 | Not found **or** a project you are not allowed to see (IDs of other projects are not revealed) |
| 409 | Conflict: stale `version` (someone else saved first), already posted/decided, or a disallowed status change |

## Roles in one line each
- **Contributor** – sees projects they are a member of; updates status/progress of tasks assigned to them; submits change requests. Cannot post costs or decide anything.
- **Project Manager** – everything a contributor can, plus full management of projects they **own** (tasks, milestones, risks, costs, forecasts, budget-revision requests, change-request decisions — never on their own request).
- **Administrator** – all projects; approves/rejects budget revisions; audit log and automation history.

## Auth
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/login` | anyone | `{ email, password }` → sets httpOnly `pmo_session` cookie |
| POST | `/auth/logout` | anyone | clears the cookie |
| GET | `/auth/me` | signed in | current user |
| GET | `/health` | anyone | API + database check |

## Reference data
| GET | `/lookups` | signed in | departments, users, cost categories, reporting date |
|---|---|---|---|

## Projects
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/projects` | signed in (scoped) | `search, departmentId, ownerId, status, startFrom, endTo, sort, order, page, pageSize` |
| GET | `/projects/:id` | member / admin | details, members, progress %, task/risk/CR counts, `canManage` |
| POST | `/projects` | PM, Admin | `name, description, departmentId, ownerId, status, startDate, endDate, initialBudget, memberIds[]` |
| PUT | `/projects/:id` | owner PM, Admin | same fields + `version` |

## Tasks
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/tasks` | signed in (scoped) | `projectId, departmentId, managerId, assigneeId, mine, unassigned, overdue, status, priority, search, sort, page` |
| GET | `/tasks/:id` | member / admin | |
| POST | `/projects/:projectId/tasks` | owner PM, Admin | `title, description, assigneeId, status, priority, startDate, dueDate, weight, progress` |
| PUT | `/tasks/:id` | owner PM, Admin — **or the assignee (status & progress only)** | any task fields + `version` |

## Milestones, risks & issues
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/milestones` | signed in (scoped) | `projectId, status, dueWithinDays` |
| POST | `/projects/:projectId/milestones` | owner PM, Admin | due date must be within project dates |
| PUT | `/milestones/:id` | owner PM, Admin | + `version` |
| GET | `/risks` | signed in (scoped) | `projectId, type, status, open, highExposure, probability, impact` |
| POST | `/projects/:projectId/risks` | owner PM, Admin | score = probability × impact (database column) |
| PUT | `/risks/:id` | owner PM, Admin | + `version`; closing needs a mitigation note |

## Change requests
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/change-requests` | signed in (scoped) | `projectId, status, mine` |
| GET | `/change-requests/:id` | member / admin | includes full `history`, `canDecide`, `canResubmit` |
| POST | `/projects/:projectId/change-requests` | any project member | `title, description, costImpact, scheduleImpactDays` |
| POST | `/change-requests/:id/decision` | owner PM, Admin (**not** the submitter) | `{ decision: APPROVE \| REJECT \| RETURN, reason, version }` |
| POST | `/change-requests/:id/resubmit` | original submitter | RETURNED → SUBMITTED |

Allowed transitions: `SUBMITTED → APPROVED / REJECTED / RETURNED`, `RETURNED → SUBMITTED`. Status change + history row + audit event commit in one transaction.

## Finance
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/projects/:projectId/finance` | member / admin | summary (budget, actual, remaining, utilization, FTC, EAC, variance), alerts, by category, monthly trend, revisions, forecasts. Optional `asOf` |
| GET | `/costs` | signed in (scoped) | `projectId, departmentId, managerId, categoryId, status, from, to, month` → also returns `totalAmount` |
| POST | `/projects/:projectId/costs` | owner PM, Admin | `categoryId, description, amount, txnDate, post` · header `Idempotency-Key` prevents duplicates |
| POST | `/costs/:id/post` | owner PM, Admin | DRAFT → POSTED (second call returns 409) |
| PUT | `/costs/:id` | owner PM, Admin | drafts only |
| DELETE | `/costs/:id` | owner PM, Admin | drafts only (posted costs are protected by a DB trigger too) |
| POST | `/projects/:projectId/budget-revisions` | owner PM, Admin | `amount (±), reason, changeRequestId?` → PENDING |
| POST | `/budget-revisions/:id/decision` | **Admin only**, not own request | `{ decision: APPROVE \| REJECT }` |
| PUT | `/projects/:projectId/forecasts` | owner PM, Admin | `{ items: [{ month: "2026-10-01", amount }] }` future months only |

## Executive dashboard
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/dashboard` | signed in (scoped to visible projects) | Filters: `departmentId, projectId, managerId, status` (project lifecycle), `from, to` (period for trend & category charts, capped at the reporting date), `categoryId` (finance charts only). Returns `kpis`, `projects` (health + budget/actual/EAC), `monthly`, `spendByCategory`, `overdueByOwner`, `riskMatrix`, `milestones` |

Drill-down lists also accept `projectStatus` (`/tasks`, `/costs`, `/risks`) so a drill-down shows exactly the records behind a filtered KPI.

## Activity
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/notifications` | signed in | own notifications + unread count |
| POST | `/notifications/:id/read` | owner of the notification | |
| GET | `/audit-events` | Admin | `action, entityType, entityId, actorId, page` |
| GET | `/automation-runs` | Admin | automation run history |
| POST | `/automation-runs/run` | Admin | run the overdue-task automation now · body `{ simulateFailure?: boolean }` |

A ready-made Postman collection is in `docs/postman_collection.json`.
