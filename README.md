# eMinds Assignment — Project Portfolio & Financial Control Portal

Full-stack PMO portal: React (Vite + Tailwind) → Express API → PostgreSQL (`pg` + plain SQL migrations).

## Prerequisites
- Node.js 20+
- Docker Desktop (running)

## Run locally (Windows PowerShell)

```powershell
# 1. Create env files from the templates (first time only)
Copy-Item .env.example .env
Copy-Item server\.env.example server\.env

# 2. Start PostgreSQL in Docker
docker compose up -d

# 3. Start the API  (terminal 1)
cd server
npm install
npm run db:migrate   # creates/updates database tables
npm run dev          # http://localhost:4000/api/health

# 4. Start the web app  (terminal 2)
cd client
npm install
npm run dev          # http://localhost:5173
```

## Project structure
```
docker-compose.yml   PostgreSQL container
server/              Express API (routes -> services -> database)
  db/migrations/     numbered .sql files that build the database
  scripts/           migrate (and later seed) scripts
  src/               API source code
client/              React frontend
```

_More sections (seed data, demo logins, API routes, tests) are added as the project grows._
