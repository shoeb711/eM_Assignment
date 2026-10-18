# Migrations

Plain SQL files that build the database step by step. They run in file-name order
(`001_...sql`, `002_...sql`), and each one runs only once (tracked in `schema_migrations`).

Run them with `npm run db:migrate` from the `server` folder.
