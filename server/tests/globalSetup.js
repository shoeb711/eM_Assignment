// Runs ONCE before all tests:
//   1. drops and re-creates the test database
//   2. runs the same migrations as the real app
//   3. imports the same seeded CSV data
import { execSync } from 'node:child_process';
import pg from 'pg';
import { testDatabaseUrl } from './testDatabase.js';

export default async function setup() {
  const testUrl = testDatabaseUrl();
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS pmo_portal_test WITH (FORCE)');
  await admin.query('CREATE DATABASE pmo_portal_test');
  await admin.end();

  const env = { ...process.env, DATABASE_URL: testUrl };
  execSync('node scripts/migrate.js', { env, stdio: 'ignore' });
  execSync('node seed/import.js', { env, stdio: 'ignore' });
}
