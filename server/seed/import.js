// =====================================================================
// CSV import  -  loads data/csv/*.csv into PostgreSQL
// ---------------------------------------------------------------------
// 1. Empties all tables (TRUNCATE ... RESTART IDENTITY)
// 2. Inserts every CSV row using parameterized INSERT statements
// 3. Moves each id counter past the highest imported id, so new rows created
//    in the app get the next free id
// Everything runs in ONE transaction: if anything fails, nothing is changed.
// Run:  npm run db:import
// =====================================================================
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { pool, withTransaction } from '../src/db.js';

const csvDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/csv');

// Parents before children, so foreign keys always point at rows that already exist.
const TABLES = [
  'departments', 'users', 'projects', 'project_members', 'tasks', 'milestones', 'risks',
  'progress_snapshots', 'change_requests', 'change_request_history', 'cost_categories',
  'budget_revisions', 'cost_transactions', 'financial_forecasts', 'automation_runs',
  'notifications', 'audit_events',
];

const BATCH_SIZE = 200; // rows per INSERT statement

async function importCsv(client, table) {
  const text = fs.readFileSync(path.join(csvDir, `${table}.csv`), 'utf8');
  // Empty CSV cells become NULL in the database.
  const rows = parse(text, { columns: true, cast: (value) => (value === '' ? null : value) });
  if (rows.length === 0) return 0;

  const columns = Object.keys(rows[0]);
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const values = [];
    // Builds: ($1, $2, $3), ($4, $5, $6), ...
    const placeholders = batch.map((row) => {
      const slots = columns.map((col) => {
        values.push(row[col]);
        return `$${values.length}`;
      });
      return `(${slots.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`,
      values,
    );
  }

  if (columns.includes('id')) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT MAX(id) FROM ${table}))`,
    );
  }
  return rows.length;
}

async function main() {
  await withTransaction(async (client) => {
    await client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
    for (const table of TABLES) {
      const count = await importCsv(client, table);
      console.log(`${table.padEnd(24)} ${String(count).padStart(4)} rows imported`);
    }
  });
  console.log('\nImport complete.');
}

main()
  .catch((err) => {
    console.error('Import failed - no changes were saved:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
