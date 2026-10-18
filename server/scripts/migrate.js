// Simple migration runner.
// Runs every .sql file in db/migrations (in file-name order) that has not been run before,
// and records it in the schema_migrations table so it never runs twice.
//   Usage: npm run db:migrate
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from '../src/db.js';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const alreadyApplied = new Set(rows.map((r) => r.filename));

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const pending = files.filter((f) => !alreadyApplied.has(f));

  if (pending.length === 0) {
    console.log('Database is up to date - no new migrations.');
    return;
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    // Each migration file + its record are saved together, so a failed file leaves no half-built tables.
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    });
    console.log(`Applied ${file}`);
  }
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
