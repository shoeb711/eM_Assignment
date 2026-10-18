// Database access helpers built on the "pg" library.
// Every query uses $1, $2 ... placeholders (parameterized queries) - values are never
// pasted into the SQL string, which is what prevents SQL injection.
import pg from 'pg';

// NUMERIC columns (money) come back from Postgres as strings to avoid rounding.
// We convert them to JS numbers here, once, for the whole app.
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

// A pool keeps a few connections open and reuses them across requests.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Run one query: const { rows } = await query('SELECT * FROM projects WHERE id = $1', [id]);
export function query(text, params) {
  return pool.query(text, params);
}

// Run several queries as ONE unit: either all are saved (COMMIT) or none are (ROLLBACK).
// Used e.g. for "approve change request + write its history row".
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
