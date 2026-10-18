// =====================================================================
// Synthetic data generator  (Assignment Section 6)
// ---------------------------------------------------------------------
// Builds realistic FICTIONAL records from seed/scenario.js using a fixed random seed,
// then writes one CSV file per table into  data/csv/.
// Run:  npm run db:generate      (then  npm run db:import  loads the CSVs into PostgreSQL)
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { stringify } from 'csv-stringify/sync';
import * as S from './scenario.js';
import {
  createRandom, addDays, daysBetween, monthStart, addMonths, lastDayOfMonth,
  monthsBetween, timestamp, round2, splitAmount,
} from './helpers.js';

const rand = createRandom(S.RANDOM_SEED);
const R = S.REPORTING_DATE;
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/csv');

const projectById = Object.fromEntries(S.projects.map((p) => [p.id, p]));
const ADMIN_ID = 1;

// ---------------------------------------------------------------------
// People / portfolio
// ---------------------------------------------------------------------
const departments = S.departments.map((d) => ({ id: d.id, name: d.name }));

// A fixed bcrypt salt keeps the CSV output identical on every run (demo data only -
// users created through the app get a normal random salt).
const passwordHash = bcrypt.hashSync(S.DEMO_PASSWORD, '$2a$10$eMindsDemoSeedSaltValu');

const users = S.users.map((u) => ({
  id: u.id,
  department_id: u.dept,
  full_name: u.name,
  email: `${u.name.toLowerCase().replace(/ /g, '.')}@demo.local`,
  password_hash: passwordHash,
  role: u.role,
  is_active: true,
}));

const projects = S.projects.map((p) => ({
  id: p.id,
  code: p.code,
  name: p.name,
  description: `Delivery of the ${p.name} initiative.`,
  department_id: p.dept,
  owner_id: p.owner,
  status: p.status,
  start_date: p.start,
  end_date: p.end,
  initial_budget: p.budget,
}));

// The owner is also stored as a member, so "my projects" is one simple lookup.
const projectMembers = S.projects.flatMap((p) =>
  [p.owner, ...p.members].map((userId) => ({ project_id: p.id, user_id: userId })),
);

// ---------------------------------------------------------------------
// Tasks (9 per project = 90)
// ---------------------------------------------------------------------
const tasks = [];
for (const p of S.projects) {
  const duration = daysBetween(p.start, p.end);
  const slots = S.taskTemplates.length + 1;

  S.taskTemplates.forEach((title, i) => {
    const startDate = addDays(p.start, Math.round((duration * i) / slots));
    const dueDate = addDays(p.start, Math.round((duration * (i + 1)) / slots));
    let status;
    let progress;

    if (p.status === 'COMPLETED') {
      status = 'DONE';
    } else if (startDate > R) {
      status = 'TODO';            // not started yet
      progress = 0;
    } else if (dueDate < R) {
      // due date has passed: most are done, some are late (overdue)
      if (rand.chance(0.7)) status = 'DONE';
      else {
        status = rand.chance(0.3) ? 'BLOCKED' : 'IN_PROGRESS';
        progress = rand.int(40, 90);
      }
    } else {
      status = 'IN_PROGRESS';     // currently running
      progress = rand.int(10, 70);
    }
    if (p.status === 'ON_HOLD' && status === 'IN_PROGRESS' && rand.chance(0.6)) status = 'BLOCKED';

    let completedAt = null;
    if (status === 'DONE') {
      progress = 100;
      const finish = dueDate < R ? dueDate : R;
      completedAt = addDays(finish, -rand.int(0, 5));
      if (completedAt < startDate) completedAt = startDate;
    }

    tasks.push({
      id: tasks.length + 1,
      project_id: p.id,
      title,
      description: `${title} for ${p.name}.`,
      assignee_id: rand.pick(p.members),
      status,
      priority: rand.pick(['LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH', 'CRITICAL']),
      start_date: startDate,
      due_date: dueDate,
      weight: rand.int(1, 5),
      progress,
      completed_at: completedAt,
    });
  });
}

// Edge case: a task due EXACTLY on the reporting date (not overdue yet - due today).
const dueTodayTask = tasks.find((t) => t.project_id === 1 && t.status === 'IN_PROGRESS');
Object.assign(dueTodayTask, { due_date: R, status: 'IN_PROGRESS', progress: 60, completed_at: null });

// Edge case: an unassigned task.
const unassignedTask = tasks.find((t) => t.project_id === 6 && t.status === 'TODO');
unassignedTask.assignee_id = null;

// Edge case: at least 5 overdue incomplete tasks (due before the reporting date, not DONE).
const isOverdue = (t) => t.status !== 'DONE' && t.due_date < R;
for (const t of tasks) {
  if (tasks.filter(isOverdue).length >= 6) break;
  if (t.status === 'DONE' && t.due_date < R && projectById[t.project_id].status !== 'COMPLETED') {
    Object.assign(t, { status: 'IN_PROGRESS', progress: 75, completed_at: null });
  }
}

// ---------------------------------------------------------------------
// Milestones (3 per project + 3 due within the next 14 days)
// ---------------------------------------------------------------------
const milestones = [];
function addMilestone(projectId, name, dueDate, forcedStatus) {
  const p = projectById[projectId];
  let status = forcedStatus;
  if (!status) {
    if (p.status === 'COMPLETED') status = 'ACHIEVED';
    else if (dueDate < R) status = rand.chance(0.8) ? 'ACHIEVED' : 'MISSED';
    else if (daysBetween(R, dueDate) <= 30) status = 'IN_PROGRESS';
    else status = 'PLANNED';
  }
  milestones.push({
    id: milestones.length + 1,
    project_id: projectId,
    name,
    due_date: dueDate,
    status,
    completed_at: status === 'ACHIEVED' ? addDays(dueDate, -rand.int(0, 3)) : null,
  });
}
for (const p of S.projects) {
  const duration = daysBetween(p.start, p.end);
  addMilestone(p.id, 'Design sign-off', addDays(p.start, Math.round(duration * 0.25)));
  addMilestone(p.id, 'Build complete', addDays(p.start, Math.round(duration * 0.65)));
  addMilestone(p.id, 'Go-live', p.end);
}
addMilestone(1, 'Beta release to pilot users', '2026-10-08', 'IN_PROGRESS');
addMilestone(3, 'Data platform readiness review', '2026-10-12', 'IN_PROGRESS');
addMilestone(10, 'Pilot branches live', '2026-10-05', 'IN_PROGRESS');

// ---------------------------------------------------------------------
// Risks & issues (24 random + 2 explicit edge cases)
// ---------------------------------------------------------------------
const risks = [];
function addRisk(projectId, template, probability, impact, status) {
  const p = projectById[projectId];
  risks.push({
    id: risks.length + 1,
    project_id: projectId,
    type: template.type,
    title: template.title,
    description: `${template.title} affecting ${p.name}.`,
    owner_id: rand.pick([p.owner, ...p.members]),
    probability,
    impact,
    mitigation: template.mitigation,
    due_date: addDays(R, rand.int(-20, 60)),
    status,
  });
}
S.projects.forEach((p, index) => {
  const count = index % 3 === 0 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const status = p.status === 'COMPLETED' ? 'CLOSED' : rand.pick(['OPEN', 'OPEN', 'OPEN', 'MITIGATING', 'CLOSED']);
    addRisk(p.id, rand.pick(S.riskTemplates), rand.int(1, 5), rand.int(1, 5), status);
  }
});
// Edge case: a CLOSED high-exposure risk (score 20) that must NOT count as open.
addRisk(9, { type: 'RISK', title: 'Payroll cut-over failure', mitigation: 'Parallel run completed successfully' }, 5, 4, 'CLOSED');
// Edge case: an OPEN high-exposure risk (score 20).
addRisk(2, { type: 'RISK', title: 'Data migration window too short', mitigation: 'Rehearse migration twice; agree weekend outage' }, 4, 5, 'OPEN');

// ---------------------------------------------------------------------
// Change requests + history (18)
// ---------------------------------------------------------------------
const changeRequests = [];
const changeRequestHistory = [];
const decisionReasons = {
  APPROVED: 'Benefit justifies the cost; within delivery tolerance.',
  REJECTED: 'Not aligned with the current phase priorities.',
  RETURNED: 'Please add a detailed cost breakdown and re-submit.',
};

function addChangeRequest({ projectId, title, cost, days, status }) {
  const p = projectById[projectId];
  const submitter = rand.chance(0.25) ? p.owner : rand.pick(p.members);
  // Nobody decides their own request: if the PM submitted it, the admin decides.
  const decider = submitter === p.owner ? ADMIN_ID : p.owner;
  const earliest = p.start > addDays(R, -150) ? p.start : addDays(R, -150);
  const submittedDate = addDays(earliest, rand.int(0, Math.max(0, daysBetween(earliest, addDays(R, -12)))));
  const decidedDate = addDays(submittedDate, rand.int(2, 10));
  const id = changeRequests.length + 1;
  const decided = status !== 'SUBMITTED';

  changeRequests.push({
    id,
    project_id: projectId,
    title,
    description: `${title} for ${p.name}.`,
    cost_impact: cost,
    schedule_impact_days: days,
    status,
    submitted_by: submitter,
    submitted_at: timestamp(submittedDate, 9),
    decided_by: decided ? decider : null,
    decided_at: decided ? timestamp(decidedDate, 14) : null,
    decision_reason: decided ? decisionReasons[status] : null,
  });

  changeRequestHistory.push({
    id: changeRequestHistory.length + 1, change_request_id: id, from_status: null, to_status: 'SUBMITTED',
    actor_id: submitter, comment: 'Change request submitted.', created_at: timestamp(submittedDate, 9),
  });
  if (decided) {
    changeRequestHistory.push({
      id: changeRequestHistory.length + 1, change_request_id: id, from_status: 'SUBMITTED', to_status: status,
      actor_id: decider, comment: decisionReasons[status], created_at: timestamp(decidedDate, 14),
    });
  }
}

// Two approved change requests that are explicitly linked to budget revisions (below).
addChangeRequest({ projectId: 2, title: 'Add data reconciliation module', cost: 150000, days: 30, status: 'APPROVED' });
addChangeRequest({ projectId: 9, title: 'Extend ERP scope to procurement module', cost: 200000, days: 45, status: 'APPROVED' });
const otherStatuses = ['REJECTED', 'RETURNED', 'SUBMITTED', 'APPROVED', 'SUBMITTED', 'REJECTED', 'APPROVED', 'SUBMITTED',
  'RETURNED', 'APPROVED', 'SUBMITTED', 'REJECTED', 'APPROVED', 'SUBMITTED', 'APPROVED', 'SUBMITTED'];
otherStatuses.forEach((status, i) => {
  const template = S.changeRequestTemplates[i % S.changeRequestTemplates.length];
  const p = S.projects[i % S.projects.length];
  addChangeRequest({ projectId: p.id, title: template.title, cost: template.cost, days: template.days, status });
});

// ---------------------------------------------------------------------
// Budget revisions (approved, pending and rejected)
// ---------------------------------------------------------------------
const budgetRevisions = [
  { id: 1, project_id: 2, amount: 150000, reason: 'Funding for approved data reconciliation module (CR-1).', status: 'APPROVED', change_request_id: 1, requested_by: 3, requested_at: timestamp('2026-06-10'), decided_by: ADMIN_ID, decided_at: timestamp('2026-06-12') },
  { id: 2, project_id: 9, amount: 200000, reason: 'Funding for procurement scope extension (CR-2).', status: 'APPROVED', change_request_id: 2, requested_by: 3, requested_at: timestamp('2026-05-04'), decided_by: ADMIN_ID, decided_at: timestamp('2026-05-06') },
  { id: 3, project_id: 1, amount: 80000, reason: 'Additional accessibility testing budget.', status: 'PENDING', change_request_id: null, requested_by: 2, requested_at: timestamp('2026-09-25'), decided_by: null, decided_at: null },
  { id: 4, project_id: 6, amount: 60000, reason: 'Offline mode for field engineers.', status: 'REJECTED', change_request_id: null, requested_by: 4, requested_at: timestamp('2026-07-15'), decided_by: ADMIN_ID, decided_at: timestamp('2026-07-20') },
  { id: 5, project_id: 10, amount: 25000, reason: 'Extra access points for two large branches.', status: 'PENDING', change_request_id: null, requested_by: 4, requested_at: timestamp('2026-09-22'), decided_by: null, decided_at: null },
];

// ---------------------------------------------------------------------
// Cost transactions
// ---------------------------------------------------------------------
const costTransactions = [];
const categoryWeights = S.costCategories.flatMap((c) => Array(c.weight).fill(c.id));

function addCost({ projectId, date, amount, status }) {
  const p = projectById[projectId];
  const categoryId = rand.pick(categoryWeights);
  const posted = status === 'POSTED';
  costTransactions.push({
    id: costTransactions.length + 1,
    project_id: projectId,
    category_id: categoryId,
    description: rand.pick(S.costDescriptions[categoryId]),
    amount,
    txn_date: date,
    status,
    created_by: rand.pick([p.owner, ...p.members]),
    created_at: timestamp(date, 9),
    posted_by: posted ? p.owner : null,
    posted_at: posted ? timestamp(addDays(date, rand.int(1, 3)), 11) : null,
  });
}

// Posted costs up to the reporting date: total = budget x targetSpend, spread over the months.
for (const p of S.projects) {
  if (p.targetSpend === 0) continue; // PRJ-004: no posted spend
  const lastDate = p.end < R ? p.end : R;
  const months = monthsBetween(p.start, lastDate);
  const total = round2(p.budget * p.targetSpend);
  const monthTotals = splitAmount(total, months.map(() => 0.6 + rand.next() * 0.8));

  months.forEach((month, i) => {
    const pieces = rand.chance(0.5) ? 2 : 1;
    const amounts = splitAmount(monthTotals[i], Array.from({ length: pieces }, () => 0.5 + rand.next()));
    const firstDay = month === monthStart(p.start) ? Number(p.start.slice(8, 10)) : 1;
    amounts.forEach((amount) => {
      const day = String(rand.int(firstDay, 28)).padStart(2, '0');
      addCost({ projectId: p.id, date: `${month.slice(0, 7)}-${day}`, amount, status: 'POSTED' });
    });
  });
}

// Draft (not yet posted) costs - excluded from actual spend.
for (const projectId of [1, 2, 3, 4, 4, 6, 9, 10]) {
  addCost({ projectId, date: addDays(R, -rand.int(1, 10)), amount: rand.int(50, 400) * 100, status: 'DRAFT' });
}
// Posted costs dated AFTER the reporting cutoff - excluded from the 30 Sep 2026 snapshot.
for (const [projectId, date] of [[1, '2026-10-03'], [2, '2026-10-06'], [9, '2026-10-09']]) {
  addCost({ projectId, date, amount: rand.int(200, 600) * 100, status: 'POSTED' });
}

// ---------------------------------------------------------------------
// Monthly forecasts (future spend after the reporting date)
// ---------------------------------------------------------------------
const financialForecasts = [];
for (const p of S.projects) {
  if (p.forecastToComplete === null) continue; // PRJ-005 (completed) and PRJ-008 (no forecast yet)
  const months = monthsBetween(addMonths(monthStart(R), 1), p.end);
  const amounts = splitAmount(p.forecastToComplete, months.map(() => 0.8 + rand.next() * 0.4));
  months.forEach((month, i) => {
    financialForecasts.push({
      id: financialForecasts.length + 1, project_id: p.id, month, amount: amounts[i], created_by: p.owner,
    });
  });
}

// ---------------------------------------------------------------------
// Progress snapshots (month-end history, April - September 2026)
// ---------------------------------------------------------------------
function weightedProgress(projectId) {
  const list = tasks.filter((t) => t.project_id === projectId);
  const totalWeight = list.reduce((sum, t) => sum + t.weight, 0);
  return list.reduce((sum, t) => sum + t.weight * t.progress, 0) / totalWeight;
}

const progressSnapshots = [];
for (const p of S.projects) {
  const currentProgress = weightedProgress(p.id);
  const finishDate = p.end < R ? p.end : R;
  for (const month of monthsBetween('2026-04-01', R)) {
    const snapshotDate = lastDayOfMonth(month);
    if (snapshotDate < p.start) continue;
    const share = Math.min(1, daysBetween(p.start, snapshotDate) / Math.max(1, daysBetween(p.start, finishDate)));
    const spendToDate = costTransactions
      .filter((c) => c.project_id === p.id && c.status === 'POSTED' && c.txn_date <= snapshotDate)
      .reduce((sum, c) => sum + c.amount, 0);
    progressSnapshots.push({
      id: progressSnapshots.length + 1,
      project_id: p.id,
      snapshot_date: snapshotDate,
      progress_pct: round2(currentProgress * share),
      actual_spend: round2(spendToDate),
    });
  }
}

// ---------------------------------------------------------------------
// Automation history: runs of the "overdue task alerts" job + the notifications they created
// ---------------------------------------------------------------------
const automationRuns = [];
const notifications = [];
const notifiedTasks = new Set();

function addRun({ startedAt, status, attempt, error, runDate }) {
  const run = {
    id: automationRuns.length + 1, job_name: 'overdue-task-alerts', status,
    started_at: startedAt, finished_at: startedAt.replace(':00:00Z', ':01:00Z'),
    items_processed: 0, attempt, error_message: error || null,
  };
  automationRuns.push(run);
  if (status !== 'SUCCESS') return;
  for (const t of tasks) {
    if (t.status === 'DONE' || t.due_date >= runDate || notifiedTasks.has(t.id)) continue;
    const p = projectById[t.project_id];
    notifiedTasks.add(t.id);
    run.items_processed += 1;
    notifications.push({
      id: notifications.length + 1,
      user_id: t.assignee_id ?? p.owner,
      project_id: p.id,
      automation_run_id: run.id,
      type: 'TASK_OVERDUE',
      title: `Task overdue: ${t.title}`,
      message: `"${t.title}" on ${p.code} was due on ${t.due_date} and is ${t.progress}% complete.`,
      event_key: `TASK_OVERDUE:task:${t.id}`, // UNIQUE - the same alert can never be created twice
      is_read: rand.chance(0.4),
      created_at: startedAt,
    });
  }
}
addRun({ startedAt: '2026-09-28T06:00:00Z', status: 'SUCCESS', attempt: 1, runDate: '2026-09-28' });
addRun({ startedAt: '2026-09-29T06:00:00Z', status: 'FAILED', attempt: 1, error: 'Database connection timeout', runDate: '2026-09-29' });
addRun({ startedAt: '2026-09-29T06:05:00Z', status: 'SUCCESS', attempt: 2, runDate: '2026-09-29' });
addRun({ startedAt: '2026-09-30T06:00:00Z', status: 'SUCCESS', attempt: 1, runDate: '2026-09-30' });

// ---------------------------------------------------------------------
// Audit events for posted costs and budget decisions
// ---------------------------------------------------------------------
const auditEvents = [];
for (const c of costTransactions.filter((x) => x.status === 'POSTED')) {
  auditEvents.push({
    id: auditEvents.length + 1, actor_id: c.posted_by, action: 'COST_POSTED', entity_type: 'cost_transaction',
    entity_id: c.id, details: JSON.stringify({ project_id: c.project_id, amount: c.amount }), request_id: 'seed', created_at: c.posted_at,
  });
}
for (const b of budgetRevisions.filter((x) => x.decided_by)) {
  auditEvents.push({
    id: auditEvents.length + 1, actor_id: b.decided_by, action: `BUDGET_REVISION_${b.status}`, entity_type: 'budget_revision',
    entity_id: b.id, details: JSON.stringify({ project_id: b.project_id, amount: b.amount }), request_id: 'seed', created_at: b.decided_at,
  });
}
auditEvents.sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((e, i) => { e.id = i + 1; });

// ---------------------------------------------------------------------
// Write CSV files (table order matters for import: parents before children)
// ---------------------------------------------------------------------
const tableOrder = [
  ['departments', departments],
  ['users', users],
  ['projects', projects],
  ['project_members', projectMembers],
  ['tasks', tasks],
  ['milestones', milestones],
  ['risks', risks],
  ['progress_snapshots', progressSnapshots],
  ['change_requests', changeRequests],
  ['change_request_history', changeRequestHistory],
  ['cost_categories', S.costCategories.map(({ id, name }) => ({ id, name }))],
  ['budget_revisions', budgetRevisions],
  ['cost_transactions', costTransactions],
  ['financial_forecasts', financialForecasts],
  ['automation_runs', automationRuns],
  ['notifications', notifications],
  ['audit_events', auditEvents],
];

fs.mkdirSync(outDir, { recursive: true });
for (const [table, rows] of tableOrder) {
  const csv = stringify(rows, {
    header: true,
    columns: Object.keys(rows[0]),
    cast: { boolean: (value) => (value ? 'true' : 'false') },
  });
  fs.writeFileSync(path.join(outDir, `${table}.csv`), csv);
  console.log(`${table.padEnd(24)} ${String(rows.length).padStart(4)} rows`);
}
console.log(`\nCSV files written to ${outDir}`);
