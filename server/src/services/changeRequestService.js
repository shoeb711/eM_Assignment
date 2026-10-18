// Change request approval workflow.
//
//   SUBMITTED --approve--> APPROVED   (final)
//   SUBMITTED --reject---> REJECTED   (final)
//   SUBMITTED --return---> RETURNED --resubmit--> SUBMITTED
//
// Rules:
//  - Any project member can submit a change request.
//  - Only the project's owner PM or an admin can decide - and NEVER on their own request.
//  - Every status change writes exactly one history row and one audit event, in the SAME
//    database transaction as the status change (all saved together or nothing saved).
//  - Approving does NOT change the budget automatically. A budget revision must be raised
//    separately and can reference the change request (explicit, auditable link).
import { query, withTransaction } from '../db.js';
import { conflict, forbidden, notFound } from '../utils/errors.js';
import { getAccessibleProject, canManageProject, addProjectScope } from '../utils/access.js';
import { createFilters, orderBy, pagination, pagedResult } from '../utils/listQuery.js';
import { logAudit } from './auditService.js';

// Which status changes are allowed, and what each decision leads to.
export const ALLOWED_TRANSITIONS = {
  SUBMITTED: ['APPROVED', 'REJECTED', 'RETURNED'],
  RETURNED: ['SUBMITTED'],
  APPROVED: [],
  REJECTED: [],
};
const DECISION_TO_STATUS = { APPROVE: 'APPROVED', REJECT: 'REJECTED', RETURN: 'RETURNED' };

export function assertTransitionAllowed(fromStatus, toStatus) {
  if (!ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
    throw conflict(`A change request cannot move from ${fromStatus} to ${toStatus}.`);
  }
}

export async function listChangeRequests(user, q) {
  const filters = createFilters();
  addProjectScope(filters, user, 'cr.project_id');
  if (q.projectId) filters.add('cr.project_id = ?', q.projectId);
  if (q.departmentId) filters.add('p.department_id = ?', q.departmentId);
  if (q.managerId) filters.add('p.owner_id = ?', q.managerId);
  if (q.status) filters.add('cr.status = ?', q.status);
  if (q.mine) filters.add('cr.submitted_by = ?', user.id);

  const { page, pageSize, limitSql } = pagination(q);
  const { rows } = await query(
    `SELECT cr.id, cr.project_id, p.code AS project_code, p.name AS project_name, p.owner_id AS project_owner_id,
            cr.title, cr.cost_impact, cr.schedule_impact_days, cr.status,
            cr.submitted_by, s.full_name AS submitted_by_name, cr.submitted_at,
            cr.decided_by, d.full_name AS decided_by_name, cr.decided_at, cr.version,
            COUNT(*) OVER() AS total_count
       FROM change_requests cr
       JOIN projects p ON p.id = cr.project_id
       JOIN users s ON s.id = cr.submitted_by
       LEFT JOIN users d ON d.id = cr.decided_by
       ${filters.where()}
       ${orderBy(q.sort, q.order || 'desc', { submitted_at: 'cr.submitted_at', status: 'cr.status', project: 'p.code' }, 'submitted_at')}
       ${limitSql}`,
    filters.params,
  );
  return pagedResult(rows, page, pageSize);
}

export async function getChangeRequest(user, crId) {
  const { rows } = await query(
    `SELECT cr.*, p.code AS project_code, p.name AS project_name,
            s.full_name AS submitted_by_name, d.full_name AS decided_by_name
       FROM change_requests cr
       JOIN projects p ON p.id = cr.project_id
       JOIN users s ON s.id = cr.submitted_by
       LEFT JOIN users d ON d.id = cr.decided_by
      WHERE cr.id = $1`,
    [crId],
  );
  if (!rows[0]) throw notFound('Change request');
  const project = await getAccessibleProject(user, rows[0].project_id);

  const history = await query(
    `SELECT h.id, h.from_status, h.to_status, h.comment, h.created_at, u.full_name AS actor_name
       FROM change_request_history h JOIN users u ON u.id = h.actor_id
      WHERE h.change_request_id = $1 ORDER BY h.created_at, h.id`,
    [crId],
  );
  const cr = rows[0];
  return {
    ...cr,
    history: history.rows,
    canDecide: cr.status === 'SUBMITTED' && canManageProject(user, project) && cr.submitted_by !== user.id,
    canResubmit: cr.status === 'RETURNED' && cr.submitted_by === user.id,
  };
}

export async function submitChangeRequest(user, projectId, data, requestId) {
  return withTransaction(async (db) => {
    await getAccessibleProject(user, projectId, db); // any member may submit
    const { rows } = await db.query(
      `INSERT INTO change_requests (project_id, title, description, cost_impact, schedule_impact_days, status, submitted_by)
       VALUES ($1, $2, $3, $4, $5, 'SUBMITTED', $6) RETURNING id`,
      [projectId, data.title, data.description, data.costImpact, data.scheduleImpactDays, user.id],
    );
    const crId = rows[0].id;
    await db.query(
      `INSERT INTO change_request_history (change_request_id, from_status, to_status, actor_id, comment)
       VALUES ($1, NULL, 'SUBMITTED', $2, 'Change request submitted.')`,
      [crId, user.id],
    );
    await logAudit(db, { actorId: user.id, action: 'CHANGE_REQUEST_SUBMITTED', entityType: 'change_request', entityId: crId, details: data, requestId });
    return crId;
  });
}

export async function decideChangeRequest(user, crId, { decision, reason, version }, requestId) {
  const newStatus = DECISION_TO_STATUS[decision];

  return withTransaction(async (db) => {
    // FOR UPDATE locks the row until this transaction ends, so two approvers clicking at the
    // same moment are handled one after the other.
    const { rows } = await db.query('SELECT * FROM change_requests WHERE id = $1 FOR UPDATE', [crId]);
    const cr = rows[0];
    if (!cr) throw notFound('Change request');
    const project = await getAccessibleProject(user, cr.project_id, db);

    if (!canManageProject(user, project)) {
      throw forbidden('Only the project manager who owns this project, or an administrator, can decide change requests.');
    }
    if (cr.submitted_by === user.id) {
      throw forbidden('You cannot decide on a change request you submitted yourself.');
    }
    if (cr.version !== version) {
      throw conflict('This change request was changed by someone else since you opened it. Please reload.');
    }
    assertTransitionAllowed(cr.status, newStatus);

    await db.query(
      `UPDATE change_requests
          SET status = $1, decided_by = $2, decided_at = now(), decision_reason = $3, version = version + 1
        WHERE id = $4`,
      [newStatus, user.id, reason, crId],
    );
    await db.query(
      `INSERT INTO change_request_history (change_request_id, from_status, to_status, actor_id, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [crId, cr.status, newStatus, user.id, reason],
    );
    await logAudit(db, {
      actorId: user.id, action: `CHANGE_REQUEST_${newStatus}`, entityType: 'change_request', entityId: crId,
      details: { from: cr.status, to: newStatus, reason }, requestId,
    });
  });
}

// A RETURNED request can be corrected and sent back for review by the person who submitted it.
export async function resubmitChangeRequest(user, crId, data, requestId) {
  return withTransaction(async (db) => {
    const { rows } = await db.query('SELECT * FROM change_requests WHERE id = $1 FOR UPDATE', [crId]);
    const cr = rows[0];
    if (!cr) throw notFound('Change request');
    await getAccessibleProject(user, cr.project_id, db);
    if (cr.submitted_by !== user.id) throw forbidden('Only the person who submitted this request can re-submit it.');
    if (cr.version !== data.version) throw conflict('This change request was changed since you opened it. Please reload.');
    assertTransitionAllowed(cr.status, 'SUBMITTED');

    await db.query(
      `UPDATE change_requests
          SET status = 'SUBMITTED', description = $1, cost_impact = $2, schedule_impact_days = $3,
              decided_by = NULL, decided_at = NULL, decision_reason = NULL, version = version + 1
        WHERE id = $4`,
      [data.description, data.costImpact, data.scheduleImpactDays, crId],
    );
    await db.query(
      `INSERT INTO change_request_history (change_request_id, from_status, to_status, actor_id, comment)
       VALUES ($1, 'RETURNED', 'SUBMITTED', $2, $3)`,
      [crId, user.id, data.comment || 'Re-submitted with requested changes.'],
    );
    await logAudit(db, { actorId: user.id, action: 'CHANGE_REQUEST_RESUBMITTED', entityType: 'change_request', entityId: crId, details: data, requestId });
  });
}
