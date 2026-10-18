// Business rules for risks and issues.
//  - score = probability x impact (calculated by the database column itself)
//  - "High exposure" = score >= 15; "open" = any status except CLOSED
//  - Only the owner PM or an admin can create/update; the risk owner must be a project member
//  - Closing a risk requires a mitigation note
import { query, withTransaction } from '../db.js';
import { config } from '../config.js';
import { badRequest, notFound, staleVersion } from '../utils/errors.js';
import { getAccessibleProject, assertCanManageProject, addProjectScope } from '../utils/access.js';
import { createFilters, orderBy, pagination, pagedResult } from '../utils/listQuery.js';
import { logAudit } from './auditService.js';

const SORTABLE = { score: 'r.score', due_date: 'r.due_date', title: 'r.title', status: 'r.status', project: 'p.code' };

export async function listRisks(user, q) {
  const filters = createFilters();
  addProjectScope(filters, user, 'r.project_id');
  if (q.projectId) filters.add('r.project_id = ?', q.projectId);
  if (q.departmentId) filters.add('p.department_id = ?', q.departmentId);
  if (q.managerId) filters.add('p.owner_id = ?', q.managerId);
  if (q.type) filters.add('r.type = ?', q.type);
  if (q.status) filters.add('r.status = ?', q.status);
  if (q.open) filters.addFixed(`r.status <> 'CLOSED'`);
  if (q.highExposure) filters.add('r.score >= ?', config.highRiskScore);
  if (q.probability) filters.add('r.probability = ?', q.probability);
  if (q.impact) filters.add('r.impact = ?', q.impact);

  const { page, pageSize, limitSql } = pagination(q);
  const { rows } = await query(
    `SELECT r.*, p.code AS project_code, p.name AS project_name, o.full_name AS owner_name,
            COUNT(*) OVER() AS total_count
       FROM risks r
       JOIN projects p ON p.id = r.project_id
       LEFT JOIN users o ON o.id = r.owner_id
       ${filters.where()}
       ${orderBy(q.sort, q.order || 'desc', SORTABLE, 'score')}, r.id
       ${limitSql}`,
    filters.params,
  );
  return pagedResult(rows, page, pageSize);
}

async function validateRisk(db, projectId, data) {
  if (data.ownerId) {
    const { rowCount } = await db.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, data.ownerId],
    );
    if (rowCount === 0) throw badRequest('The risk owner must be a member of this project.');
  }
  if (data.status === 'CLOSED' && !data.mitigation) {
    throw badRequest('Add a mitigation note before closing a risk.');
  }
}

export async function createRisk(user, projectId, data, requestId) {
  return withTransaction(async (db) => {
    const project = await getAccessibleProject(user, projectId, db);
    assertCanManageProject(user, project);
    await validateRisk(db, projectId, data);
    const { rows } = await db.query(
      `INSERT INTO risks (project_id, type, title, description, owner_id, probability, impact, mitigation, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [projectId, data.type, data.title, data.description, data.ownerId, data.probability, data.impact,
        data.mitigation, data.dueDate, data.status],
    );
    await logAudit(db, { actorId: user.id, action: 'RISK_CREATED', entityType: 'risk', entityId: rows[0].id, details: data, requestId });
    return rows[0];
  });
}

export async function updateRisk(user, riskId, data, requestId) {
  return withTransaction(async (db) => {
    const { rows: found } = await db.query('SELECT project_id FROM risks WHERE id = $1', [riskId]);
    if (!found[0]) throw notFound('Risk');
    const project = await getAccessibleProject(user, found[0].project_id, db);
    assertCanManageProject(user, project);
    await validateRisk(db, project.id, data);

    const { rows } = await db.query(
      `UPDATE risks
          SET type = $1, title = $2, description = $3, owner_id = $4, probability = $5, impact = $6,
              mitigation = $7, due_date = $8, status = $9, version = version + 1, updated_at = now()
        WHERE id = $10 AND version = $11
        RETURNING *`,
      [data.type, data.title, data.description, data.ownerId, data.probability, data.impact,
        data.mitigation, data.dueDate, data.status, riskId, data.version],
    );
    if (!rows[0]) throw staleVersion();
    await logAudit(db, { actorId: user.id, action: 'RISK_UPDATED', entityType: 'risk', entityId: riskId, details: data, requestId });
    return rows[0];
  });
}
