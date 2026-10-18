// =====================================================================
// Automation: "overdue task alerts"  (Assignment Section 8.1)
// ---------------------------------------------------------------------
// TRIGGER  : every few minutes (timer in server.js) or "Run now" by an admin.
// RULE     : a task that is not DONE and is past its due date (reporting date), on a project
//            that is not completed/cancelled, gets ONE in-app alert to its assignee
//            (or to the project manager when the task is unassigned).
// OUTCOME  : rows in `notifications` (shown on the Notifications page).
// RUN LOG  : one row per attempt in `automation_runs` (RUNNING -> SUCCESS / FAILED + error).
//
// Safety:
//  - No duplicates: every alert has a unique event_key ("TASK_OVERDUE:task:42").
//    The INSERT uses ON CONFLICT (event_key) DO NOTHING, so re-running the job - or two runs
//    at the same moment - can never create the same alert twice.
//  - All-or-nothing: the alerts of one attempt are inserted in a single transaction.
//  - Retry: a failed attempt is logged as FAILED with its error, then retried (up to 3 attempts,
//    waiting a little longer each time). Because of the unique key, a retry is always safe.
// =====================================================================
import { query, withTransaction } from '../db.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const JOB_NAME = 'overdue-task-alerts';
const MAX_ATTEMPTS = 3;

// The actual work of one attempt. Returns how many NEW alerts were created.
async function createOverdueAlerts(db, runId, asOf) {
  const { rows } = await db.query(
    `INSERT INTO notifications (user_id, project_id, automation_run_id, type, title, message, event_key)
     SELECT COALESCE(t.assignee_id, p.owner_id),
            p.id,
            $1,
            'TASK_OVERDUE',
            'Task overdue: ' || t.title,
            format('"%s" on %s was due on %s and is %s%% complete.', t.title, p.code, to_char(t.due_date, 'DD Mon YYYY'), t.progress),
            'TASK_OVERDUE:task:' || t.id
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
      WHERE t.status <> 'DONE'
        AND t.due_date < $2::date
        AND p.status NOT IN ('COMPLETED', 'CANCELLED')
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [runId, asOf],
  );
  return rows.length;
}

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Runs the job with retries.
 * @param {object}  options
 * @param {boolean} options.simulateFailure  make attempt 1 fail on purpose (to demo the retry in the interview)
 * @param {number}  options.retryDelayMs     base wait between attempts (attempt n waits n x this)
 * @returns {{ status, attempts, created, runIds }}
 */
export async function runOverdueTaskAlerts({ simulateFailure = false, retryDelayMs = 1000 } = {}) {
  const runIds = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    // 1. Log the start of this attempt (outside the work transaction, so it survives a failure).
    const { rows } = await query(
      `INSERT INTO automation_runs (job_name, status, attempt) VALUES ($1, 'RUNNING', $2) RETURNING id`,
      [JOB_NAME, attempt],
    );
    const runId = rows[0].id;
    runIds.push(runId);

    try {
      // 2. Do the work in one transaction.
      const created = await withTransaction(async (db) => {
        if (simulateFailure && attempt === 1) throw new Error('Simulated failure (demo): database connection lost');
        return createOverdueAlerts(db, runId, config.reportingDate);
      });

      // 3a. Success: record the outcome.
      await query(
        `UPDATE automation_runs SET status = 'SUCCESS', finished_at = now(), items_processed = $1 WHERE id = $2`,
        [created, runId],
      );
      logger.info('automation run succeeded', { job: JOB_NAME, runId, attempt, created });
      return { status: 'SUCCESS', attempts: attempt, created, runIds };
    } catch (err) {
      // 3b. Failure: record the error; nothing from this attempt was saved (transaction rolled back).
      await query(
        `UPDATE automation_runs SET status = 'FAILED', finished_at = now(), error_message = $1 WHERE id = $2`,
        [err.message.slice(0, 500), runId],
      );
      logger.error('automation run failed', { job: JOB_NAME, runId, attempt, error: err.message });
      if (attempt < MAX_ATTEMPTS) await wait(retryDelayMs * attempt);
    }
  }
  return { status: 'FAILED', attempts: MAX_ATTEMPTS, created: 0, runIds };
}

// Starts the automatic schedule (called from server.js, never from tests).
export function scheduleOverdueTaskAlerts(minutes) {
  const run = () => runOverdueTaskAlerts().catch((err) => logger.error('automation crashed', { error: err.message }));
  setTimeout(run, 5_000); // first run shortly after start-up
  return setInterval(run, minutes * 60 * 1000);
}
