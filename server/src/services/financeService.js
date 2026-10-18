// Finance module: budgets, budget revisions, cost transactions, forecasts and summaries.
//
// Who can do what:
//   - Everyone on the project can VIEW its finance.
//   - Owner PM / admin can create costs, post costs, request budget revisions and edit forecasts.
//   - Only an ADMIN can approve/reject a budget revision, and never their own request.
//   - Contributors cannot create or post any financial transaction (checked here on the server).
//   - POSTED costs can never be edited or deleted (checked here AND by a database trigger).
import { query, withTransaction } from '../db.js';
import { config } from '../config.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { getAccessibleProject, assertCanManageProject, canManageProject, addProjectScope } from '../utils/access.js';
import { createFilters, orderBy, pagination, pagedResult } from '../utils/listQuery.js';
import { PROJECT_FINANCIALS_SQL, budgetAlerts } from '../sql/projectFinancials.js';
import { logAudit } from './auditService.js';

// ---------------------------------------------------------------------
// Summary for one project
// ---------------------------------------------------------------------
export async function getProjectFinance(user, projectId, asOf = config.reportingDate) {
  const project = await getAccessibleProject(user, projectId);

  const [summary, byCategory, monthly, revisions, forecasts] = await Promise.all([
    query(`${PROJECT_FINANCIALS_SQL} WHERE f.project_id = $2`, [asOf, projectId]),
    // Spend by category (posted, up to the reporting date)
    query(
      `SELECT c.id AS category_id, c.name AS category, COALESCE(SUM(t.amount), 0) AS amount
         FROM cost_categories c
         LEFT JOIN cost_transactions t
                ON t.category_id = c.id AND t.project_id = $1 AND t.status = 'POSTED' AND t.txn_date <= $2::date
        GROUP BY c.id, c.name ORDER BY c.id`,
      [projectId, asOf],
    ),
    // Monthly trend: actual spend per past month + forecast per future month
    query(
      `SELECT to_char(m.month, 'YYYY-MM') AS month, COALESCE(a.actual, 0) AS actual, COALESCE(fc.amount, 0) AS forecast
         FROM (SELECT date_trunc('month', txn_date)::date AS month FROM cost_transactions
                WHERE project_id = $1 AND status = 'POSTED' AND txn_date <= $2::date
               UNION
               SELECT month FROM financial_forecasts WHERE project_id = $1 AND month > date_trunc('month', $2::date)) m
         LEFT JOIN (SELECT date_trunc('month', txn_date)::date AS month, SUM(amount) AS actual
                      FROM cost_transactions
                     WHERE project_id = $1 AND status = 'POSTED' AND txn_date <= $2::date
                     GROUP BY 1) a ON a.month = m.month
         LEFT JOIN financial_forecasts fc ON fc.project_id = $1 AND fc.month = m.month AND fc.month > date_trunc('month', $2::date)
        ORDER BY m.month`,
      [projectId, asOf],
    ),
    query(
      `SELECT b.*, r.full_name AS requested_by_name, d.full_name AS decided_by_name
         FROM budget_revisions b
         JOIN users r ON r.id = b.requested_by
         LEFT JOIN users d ON d.id = b.decided_by
        WHERE b.project_id = $1 ORDER BY b.requested_at DESC`,
      [projectId],
    ),
    query(
      `SELECT id, to_char(month, 'YYYY-MM-DD') AS month, amount FROM financial_forecasts
        WHERE project_id = $1 ORDER BY month`,
      [projectId],
    ),
  ]);

  const row = summary.rows[0];
  return {
    asOf,
    summary: row,
    alerts: budgetAlerts(row),
    byCategory: byCategory.rows,
    monthly: monthly.rows,
    budgetRevisions: revisions.rows,
    forecasts: forecasts.rows,
    permissions: {
      canManage: canManageProject(user, project),
      canDecideRevisions: user.role === 'ADMIN',
    },
  };
}

// ---------------------------------------------------------------------
// Cost transactions
// ---------------------------------------------------------------------
const COST_SORTABLE = { txn_date: 't.txn_date', amount: 't.amount', project: 'p.code', category: 'c.name', status: 't.status' };

export async function listCosts(user, q) {
  const filters = createFilters();
  addProjectScope(filters, user, 't.project_id');
  if (q.projectId) filters.add('t.project_id = ?', q.projectId);
  if (q.departmentId) filters.add('p.department_id = ?', q.departmentId);
  if (q.managerId) filters.add('p.owner_id = ?', q.managerId);
  if (q.categoryId) filters.add('t.category_id = ?', q.categoryId);
  if (q.status) filters.add('t.status = ?', q.status);
  if (q.from) filters.add('t.txn_date >= ?', q.from);
  if (q.to) filters.add('t.txn_date <= ?', q.to);
  if (q.month) filters.add(`date_trunc('month', t.txn_date) = date_trunc('month', ?::date)`, `${q.month}-01`);

  const { page, pageSize, limitSql } = pagination(q);
  const { rows } = await query(
    `SELECT t.id, t.project_id, p.code AS project_code, p.name AS project_name,
            t.category_id, c.name AS category, t.description, t.amount, t.txn_date, t.status,
            cb.full_name AS created_by_name, t.created_at, pb.full_name AS posted_by_name, t.posted_at,
            COUNT(*) OVER() AS total_count,
            SUM(t.amount) OVER() AS total_amount
       FROM cost_transactions t
       JOIN projects p ON p.id = t.project_id
       JOIN cost_categories c ON c.id = t.category_id
       JOIN users cb ON cb.id = t.created_by
       LEFT JOIN users pb ON pb.id = t.posted_by
       ${filters.where()}
       ${orderBy(q.sort, q.order || 'desc', COST_SORTABLE, 'txn_date')}, t.id DESC
       ${limitSql}`,
    filters.params,
  );
  // total_amount lets a drill-down show "these transactions add up to the KPI value".
  const totalAmount = rows[0]?.total_amount ?? 0;
  const result = pagedResult(rows.map(({ total_amount, ...r }) => r), page, pageSize);
  return { ...result, totalAmount };
}

async function getCostWithProject(user, db, costId) {
  const { rows } = await db.query('SELECT * FROM cost_transactions WHERE id = $1', [costId]);
  if (!rows[0]) throw notFound('Cost transaction');
  const project = await getAccessibleProject(user, rows[0].project_id, db);
  return { cost: rows[0], project };
}

function checkCostDate(project, txnDate) {
  if (txnDate < project.start_date) throw badRequest(`Cost date cannot be before the project start (${project.start_date}).`);
}

// Creates a DRAFT cost, or a POSTED one straight away when data.post is true.
// idempotencyKey: if the same key is sent twice (double click, network retry), the first
// cost is returned instead of creating a duplicate.
export async function createCost(user, projectId, data, idempotencyKey, requestId) {
  return withTransaction(async (db) => {
    const project = await getAccessibleProject(user, projectId, db);
    assertCanManageProject(user, project);
    checkCostDate(project, data.txnDate);

    if (idempotencyKey) {
      const { rows: existing } = await db.query('SELECT id FROM cost_transactions WHERE idempotency_key = $1', [idempotencyKey]);
      if (existing[0]) return { id: existing[0].id, replayed: true };
    }

    const status = data.post ? 'POSTED' : 'DRAFT';
    const { rows } = await db.query(
      `INSERT INTO cost_transactions
              (project_id, category_id, description, amount, txn_date, status, created_by, posted_by, posted_at, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [projectId, data.categoryId, data.description, data.amount, data.txnDate, status, user.id,
        data.post ? user.id : null, data.post ? new Date() : null, idempotencyKey || null],
    );
    const costId = rows[0].id;
    await logAudit(db, {
      actorId: user.id, action: data.post ? 'COST_POSTED' : 'COST_DRAFTED', entityType: 'cost_transaction', entityId: costId,
      details: { project_id: projectId, amount: data.amount, txn_date: data.txnDate }, requestId,
    });
    return { id: costId, replayed: false };
  });
}

// DRAFT -> POSTED. The WHERE status = 'DRAFT' makes a second click harmless.
export async function postCost(user, costId, requestId) {
  return withTransaction(async (db) => {
    const { cost, project } = await getCostWithProject(user, db, costId);
    assertCanManageProject(user, project);

    const { rowCount } = await db.query(
      `UPDATE cost_transactions SET status = 'POSTED', posted_by = $1, posted_at = now()
        WHERE id = $2 AND status = 'DRAFT'`,
      [user.id, costId],
    );
    if (rowCount === 0) throw conflict('This cost has already been posted.');
    await logAudit(db, {
      actorId: user.id, action: 'COST_POSTED', entityType: 'cost_transaction', entityId: costId,
      details: { project_id: cost.project_id, amount: cost.amount, txn_date: cost.txn_date }, requestId,
    });
  });
}

export async function updateDraftCost(user, costId, data, requestId) {
  return withTransaction(async (db) => {
    const { cost, project } = await getCostWithProject(user, db, costId);
    assertCanManageProject(user, project);
    if (cost.status !== 'DRAFT') throw conflict('Posted costs cannot be edited.');
    checkCostDate(project, data.txnDate);
    await db.query(
      `UPDATE cost_transactions SET category_id = $1, description = $2, amount = $3, txn_date = $4 WHERE id = $5`,
      [data.categoryId, data.description, data.amount, data.txnDate, costId],
    );
    await logAudit(db, { actorId: user.id, action: 'COST_DRAFT_UPDATED', entityType: 'cost_transaction', entityId: costId, details: data, requestId });
  });
}

export async function deleteDraftCost(user, costId, requestId) {
  return withTransaction(async (db) => {
    const { cost, project } = await getCostWithProject(user, db, costId);
    assertCanManageProject(user, project);
    if (cost.status !== 'DRAFT') throw conflict('Posted costs cannot be deleted.');
    await db.query('DELETE FROM cost_transactions WHERE id = $1', [costId]);
    await logAudit(db, {
      actorId: user.id, action: 'COST_DRAFT_DELETED', entityType: 'cost_transaction', entityId: costId,
      details: { project_id: cost.project_id, amount: cost.amount }, requestId,
    });
  });
}

// ---------------------------------------------------------------------
// Budget revisions
// ---------------------------------------------------------------------
export async function requestBudgetRevision(user, projectId, data, requestId) {
  return withTransaction(async (db) => {
    const project = await getAccessibleProject(user, projectId, db);
    assertCanManageProject(user, project);

    // Optional link to a change request: must be on this project and already APPROVED.
    if (data.changeRequestId) {
      const { rows } = await db.query('SELECT project_id, status FROM change_requests WHERE id = $1', [data.changeRequestId]);
      if (!rows[0] || rows[0].project_id !== projectId) throw badRequest('The linked change request is not on this project.');
      if (rows[0].status !== 'APPROVED') throw badRequest('Only an APPROVED change request can be linked to a budget revision.');
    }

    const { rows } = await db.query(
      `INSERT INTO budget_revisions (project_id, amount, reason, status, change_request_id, requested_by)
       VALUES ($1, $2, $3, 'PENDING', $4, $5) RETURNING id`,
      [projectId, data.amount, data.reason, data.changeRequestId ?? null, user.id],
    );
    await logAudit(db, { actorId: user.id, action: 'BUDGET_REVISION_REQUESTED', entityType: 'budget_revision', entityId: rows[0].id, details: { project_id: projectId, ...data }, requestId });
    return rows[0].id;
  });
}

export async function decideBudgetRevision(user, revisionId, { decision }, requestId) {
  if (user.role !== 'ADMIN') throw forbidden('Only an administrator can approve or reject budget revisions.');
  const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  return withTransaction(async (db) => {
    const { rows } = await db.query('SELECT * FROM budget_revisions WHERE id = $1 FOR UPDATE', [revisionId]);
    const revision = rows[0];
    if (!revision) throw notFound('Budget revision');
    if (revision.requested_by === user.id) throw forbidden('You cannot decide on a budget revision you requested.');
    if (revision.status !== 'PENDING') throw conflict(`This revision is already ${revision.status}.`);

    await db.query(
      `UPDATE budget_revisions SET status = $1, decided_by = $2, decided_at = now() WHERE id = $3`,
      [newStatus, user.id, revisionId],
    );
    await logAudit(db, {
      actorId: user.id, action: `BUDGET_REVISION_${newStatus}`, entityType: 'budget_revision', entityId: revisionId,
      details: { project_id: revision.project_id, amount: revision.amount }, requestId,
    });
    return revision.project_id;
  });
}

// ---------------------------------------------------------------------
// Monthly forecasts (insert or update each month)
// ---------------------------------------------------------------------
export async function saveForecasts(user, projectId, items, requestId) {
  const firstFutureMonth = new Date(`${config.reportingDate.slice(0, 7)}-01T00:00:00Z`);
  firstFutureMonth.setUTCMonth(firstFutureMonth.getUTCMonth() + 1);
  const minMonth = firstFutureMonth.toISOString().slice(0, 10);

  for (const item of items) {
    if (!item.month.endsWith('-01')) throw badRequest(`Forecast month ${item.month} must be the 1st of a month.`);
    if (item.month < minMonth) throw badRequest(`Forecasts are for future months only (from ${minMonth}).`);
  }

  return withTransaction(async (db) => {
    const project = await getAccessibleProject(user, projectId, db);
    assertCanManageProject(user, project);
    for (const item of items) {
      await db.query(
        `INSERT INTO financial_forecasts (project_id, month, amount, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, month) DO UPDATE SET amount = EXCLUDED.amount, created_by = EXCLUDED.created_by, created_at = now()`,
        [projectId, item.month, item.amount, user.id],
      );
    }
    await logAudit(db, { actorId: user.id, action: 'FORECAST_UPDATED', entityType: 'project', entityId: projectId, details: { items }, requestId });
  });
}
