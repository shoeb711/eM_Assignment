# Security notes

| Topic | What is done | Where |
|---|---|---|
| **Authentication** | Email + password; passwords hashed with **bcrypt**. Same error for unknown email and wrong password (no user enumeration). Failed logins are audited. | `services/authService.js` |
| **Session token** | Signed **JWT** (8 h) in an **httpOnly** cookie (JavaScript cannot read it), **SameSite=Lax** (not sent on cross-site posts → CSRF protection), **Secure** in production (HTTPS only). | `middleware/auth.js` |
| **User state** | The user is reloaded from the database on every request, so deactivation or a role change takes effect immediately. | `requireAuth` |
| **Role-based access** | Checked on the **server** for every sensitive route - the UI hiding a button is only convenience. Contributor calling approval or cost-posting endpoints directly → **403** (automated test + Postman collection). | `utils/access.js`, services |
| **Cross-project access / ID escalation** | Every record is loaded together with its project, and the user must own/belong to that project. Projects the user may not see return **404**, so IDs cannot be discovered by guessing. List queries add a membership condition. | `getAccessibleProject`, `addProjectScope` |
| **Self-approval** | Blocked in the service **and** by a database CHECK constraint (`decided_by <> submitted_by`). | migration `001_init.sql` |
| **SQL injection** | All values are sent as **parameters** (`$1, $2…`), never concatenated. Column names for sorting come from an **allow-list**. | `db.js`, `utils/listQuery.js` |
| **Input validation** | Every body and query string is validated with **zod** (types, ranges, lengths, dates, 2-decimal money). Unknown fields are rejected on task updates (`.strict()`). Body size limited to 100 kB. | `routes/*`, `app.js` |
| **Error leakage** | Unexpected errors return a generic message + request ID; the stack trace goes only to the server log. | `middleware/errorHandler.js` |
| **Secrets** | `JWT_SECRET`, database password in `.env` files that are **git-ignored**; only `*.env.example` templates are committed. The app refuses to start without `JWT_SECRET`. | `.gitignore`, `config.js` |
| **CORS** | Not enabled: the React app and API are served from one origin (Vite proxy in development, one domain / reverse proxy in production), so no cross-origin access is allowed at all. | `client/vite.config.js` |
| **Tamper-proof history** | Posted costs cannot be edited/deleted; change-request history and audit events are append-only (database triggers). | migration |
| **Audit trail** | Logins, failed logins, project/task changes, cost drafting/posting, revisions, change-request decisions, forecast updates, automation triggers - each with actor, time, details and request ID. | `audit_events` |
| **Framework fingerprint** | `X-Powered-By` header disabled. | `app.js` |

## Known gaps (would be next for production)
- No login rate limiting / account lockout (would add `express-rate-limit` on `/auth/login`).
- No security headers package (would add `helmet` for CSP, HSTS, etc.).
- Demo users share one demo password; seed password hashes use a fixed salt so the CSVs are reproducible (real users get a random salt).
- Single-factor login; production would use the company identity provider (e.g. Microsoft Entra ID via OIDC).
