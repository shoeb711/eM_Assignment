// Database access helpers built on the "pg" library.
// Every query uses $1, $2 ... placeholders (parameterized queries) - values are never
// pasted into the SQL string, which is what prevents SQL injection.
import pg from 'pg';
import { config } from './config.js';

// How Postgres types are turned into JavaScript values:
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // NUMERIC (money) -> number
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));   // BIGINT (COUNT results) -> number
pg.types.setTypeParser(1082, (v) => v);                                // DATE -> keep '2026-09-30' (no timezone shifts)

// A pool keeps a few connections open and reuses them across requests.
export const pool = new pg.Pool({ connectionString: config.databaseUrl });

// Run one query: const { rows } = await query('SELECT * FROM projects WHERE id = $1', [id]);
export function query(text, params) {
  return pool.query(text, params);
}

// Run several queries as ONE unit: either all are saved (COMMIT) or none are (ROLLBACK).
// Used e.g. for "approve change request + write its history row + write audit event".
export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
