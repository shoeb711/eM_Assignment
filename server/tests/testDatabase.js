// Tests use their OWN database ("pmo_portal_test"), created fresh before every test run,
// so running the tests never changes the demo data you show in the interview.
import 'dotenv/config';

export function testDatabaseUrl() {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/pmo_portal_test';
  return url.toString();
}
