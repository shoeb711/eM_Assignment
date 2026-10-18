// =====================================================================
// Automated checks (Assignment 3.5 / acceptance test H)
// Each test calls the real API (Express app + PostgreSQL test database) like Postman would.
// Run:  npm test
// =====================================================================
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool, query } from '../src/db.js';
import { assertTransitionAllowed } from '../src/services/changeRequestService.js';
import { runOverdueTaskAlerts } from '../src/jobs/overdueTaskAlerts.js';

// Signs in and returns an "agent" that keeps the session cookie for the next requests.
async function signIn(email) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: 'Demo@123' });
  expect(res.status).toBe(200);
  return agent;
}

const ADMIN = 'layla.haddad@demo.local';
const PM_PRIYA = 'priya.nair@demo.local';   // owns PRJ-002, PRJ-005, PRJ-009
const CONTRIBUTOR = 'chen.wei@demo.local';  // member of PRJ-002, 003, 007, 009

afterAll(async () => {
  await pool.end();
});

describe('Role-based access (server-side, even if the UI is bypassed)', () => {
  it('a Contributor calling the approval API directly is refused (403)', async () => {
    const chen = await signIn(CONTRIBUTOR);
    // CR 5 is SUBMITTED on PRJ-003, a project Chen can see
    const res = await chen.post('/api/change-requests/5/decision').send({ decision: 'APPROVE', reason: 'Trying to approve', version: 1 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('a Contributor calling the cost-posting API directly is refused (403)', async () => {
    const chen = await signIn(CONTRIBUTOR);
    const res = await chen.post('/api/projects/2/costs').send({ categoryId: 1, description: 'Not allowed', amount: 100, txnDate: '2026-09-20', post: true });
    expect(res.status).toBe(403);
  });

  it('a project the user is not a member of is hidden (404), preventing ID guessing', async () => {
    const chen = await signIn(CONTRIBUTOR);
    const res = await chen.get('/api/projects/1');
    expect(res.status).toBe(404);
  });
});

describe('Change request workflow', () => {
  it('nobody can approve their own change request', async () => {
    const priya = await signIn(PM_PRIYA);
    const created = await priya.post('/api/projects/2/change-requests').send({ title: 'Own request test', description: 'PM submits her own request.' });
    expect(created.status).toBe(201);
    const res = await priya.post(`/api/change-requests/${created.body.id}/decision`).send({ decision: 'APPROVE', reason: 'Self approval', version: 1 });
    expect(res.status).toBe(403);
  });

  it('approval writes exactly one history row, and an APPROVED request cannot be rejected afterwards', async () => {
    const chen = await signIn(CONTRIBUTOR);
    const priya = await signIn(PM_PRIYA);
    const cr = await chen.post('/api/projects/2/change-requests').send({ title: 'Workflow test', description: 'Contributor submits, PM decides.' });

    const approved = await priya.post(`/api/change-requests/${cr.body.id}/decision`).send({ decision: 'APPROVE', reason: 'Within contingency', version: 1 });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.history).toHaveLength(2); // SUBMITTED + APPROVED

    const rejectAfter = await priya.post(`/api/change-requests/${cr.body.id}/decision`).send({ decision: 'REJECT', reason: 'Changed my mind', version: 2 });
    expect(rejectAfter.status).toBe(409);
  });

  it('the transition table only allows the documented status changes', () => {
    expect(() => assertTransitionAllowed('SUBMITTED', 'APPROVED')).not.toThrow();
    expect(() => assertTransitionAllowed('RETURNED', 'SUBMITTED')).not.toThrow();
    expect(() => assertTransitionAllowed('APPROVED', 'REJECTED')).toThrow();
    expect(() => assertTransitionAllowed('REJECTED', 'SUBMITTED')).toThrow();
  });
});

describe('Financial calculations', () => {
  it('PRJ-002 follows the documented formulas (approved revisions only, posted costs to the cutoff, EAC)', async () => {
    const priya = await signIn(PM_PRIYA);
    const { body } = await priya.get('/api/projects/2/finance');
    const s = body.summary;

    // current approved budget = initial 2,500,000 + approved revision 150,000 (pending/rejected ignored)
    expect(s.current_budget).toBe(2_650_000);
    // actual spend = posted costs on/before 30 Sep 2026 (the draft and the October cost are excluded)
    expect(s.actual_spend).toBe(2_000_000);
    expect(s.remaining_budget).toBe(650_000);
    expect(s.utilization_pct).toBe(75.5);
    // EAC = actual + forecast-to-complete (1,000,000); variance = budget - EAC
    expect(s.eac).toBe(3_000_000);
    expect(s.projected_variance).toBe(-350_000);
    expect(body.alerts.map((a) => a.type)).toContain('FORECAST_OVERRUN');
  });

  it('a DRAFT cost does not count as actual spend until it is posted', async () => {
    const priya = await signIn(PM_PRIYA);
    const actual = async () => (await priya.get('/api/projects/9/finance')).body.summary.actual_spend;
    const before = await actual();

    const draft = await priya.post('/api/projects/9/costs').send({ categoryId: 2, description: 'Draft licence', amount: 5000, txnDate: '2026-09-15' });
    expect(draft.status).toBe(201);
    expect(await actual()).toBe(before); // draft ignored

    const posted = await priya.post(`/api/costs/${draft.body.id}/post`);
    expect(posted.status).toBe(200);
    expect(await actual()).toBe(before + 5000); // now counted

    const again = await priya.post(`/api/costs/${draft.body.id}/post`);
    expect(again.status).toBe(409); // double click is harmless
  });
});

describe('Automation: overdue task alerts', () => {
  it('never creates the same alert twice and retries after a failure', async () => {
    const first = await runOverdueTaskAlerts({ retryDelayMs: 10 });
    expect(first.status).toBe('SUCCESS');

    const second = await runOverdueTaskAlerts({ retryDelayMs: 10 });
    expect(second.created).toBe(0); // everything was already alerted -> no duplicates

    const { rows } = await query(`SELECT event_key, COUNT(*) AS n FROM notifications GROUP BY event_key HAVING COUNT(*) > 1`);
    expect(rows).toHaveLength(0);

    const retried = await runOverdueTaskAlerts({ simulateFailure: true, retryDelayMs: 10 });
    expect(retried.status).toBe('SUCCESS');
    expect(retried.attempts).toBe(2);
    const runs = await query('SELECT status FROM automation_runs WHERE id = ANY($1) ORDER BY id', [retried.runIds]);
    expect(runs.rows.map((r) => r.status)).toEqual(['FAILED', 'SUCCESS']);
  });

  it('only an administrator can trigger the automation through the API', async () => {
    const chen = await signIn(CONTRIBUTOR);
    expect((await chen.post('/api/automation-runs/run').send({})).status).toBe(403);
    const admin = await signIn(ADMIN);
    const res = await admin.post('/api/automation-runs/run').send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
  });
});
