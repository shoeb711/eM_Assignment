# eMinds Assignment - Project Portfolio & Financial Control Portal

A web app for a PMO team to manage projects, tasks, risks, change requests and project finances in one place,
with a live executive dashboard on top.

- **Frontend:** React 19 + Vite + Tailwind
- **Backend:** Node.js + Express 5
- **Database:** PostgreSQL 16, running in Docker
- **Tests:** Vitest + Supertest

---

## Setup

**You need:** Node.js 20+ and Docker Desktop (running).

Run these in PowerShell from the project folder:

```powershell
# 1. Create the env files (first time only)
Copy-Item .env.example .env
Copy-Item server\.env.example server\.env

# 2. Start the database
docker compose up -d
```

**Terminal 1 - API**
```powershell
cd server
npm install
npm run db:migrate   # create the tables
npm run db:seed      # load the demo data
npm run dev          # API on http://localhost:4000
```

**Terminal 2 - Web app**
```powershell
cd client
npm install
npm run dev          # open http://localhost:5173
```

To reset the demo data at any time: `cd server` then `npm run db:import`.

---

## Log in

Password for every user: **`Demo@123`**

| Email | Role |
|---|---|
| layla.haddad@demo.local | Admin - sees everything |
| priya.nair@demo.local | Project Manager (PRJ-002, 005, 009) |
| chen.wei@demo.local | Contributor - own tasks only |

---

## 5-minute demo

1. **Layla (Admin)** → *Dashboard*: KPIs, charts and filters. Click *Actual spend* to see the transactions behind it.
2. **Priya (PM)** → *Projects* → **+ New project** → add a task.
3. **Chen (Contributor)** → *Tasks* → update progress on his task. He has no *Add cost* or *Approve* buttons.
4. **Priya** → PRJ-002 → *Finance* → **+ Add cost** (date on or before 30 Sep 2026, *Post immediately*). Actual spend updates.
5. **Chen** → PRJ-002 → *Change requests* → submit one. **Priya** approves it with a reason; the history shows 2 entries.
6. **Layla** → *Audit & automation* → **Run now** (tick *Simulate a failure* to see the retry).

---

## Run the tests

```powershell
cd server
npm test
```

Runs 10 API tests against a separate test database, so the demo data is never touched.

---

## Where to find things

| What | Where |
|---|---|
| API routes and who can call them | [`docs/api-routes.md`](docs/api-routes.md) · Postman: `docs/postman_collection.json` |
| Database design (ER diagram) | [`docs/er-diagram.md`](docs/er-diagram.md) · tables: `server/db/migrations/001_init.sql` |
| Demo data and CSVs | `data/csv/` · [`docs/data-dictionary.md`](docs/data-dictionary.md) |
| SQL report queries | [`docs/sql/report-queries.sql`](docs/sql/report-queries.sql) |
| Dashboard KPIs checked against SQL | [`docs/kpi-reconciliation.md`](docs/kpi-reconciliation.md) |
| Architecture, security | [`docs/architecture.md`](docs/architecture.md) · [`docs/security.md`](docs/security.md) |
| Tests and acceptance checklist (A-H) | [`docs/testing.md`](docs/testing.md) |
| How AI was used | [`docs/ai-development-log.md`](docs/ai-development-log.md) |
| Presentation | `docs/eMinds-PMO-Portal-Presentation.pptx` |

**Code layout:** `server/src` goes routes → services → database (business rules live in `services/`).
`client/src/pages` has one file per screen.

---

## Not included

- **Power BI** - I don't have hands-on Power BI experience, so I provided the SQL report queries and a
  SQL-vs-dashboard reconciliation instead.
- **MS Access / VBA** (optional part).
- **Hosting** - the app runs locally, which the brief allows.
