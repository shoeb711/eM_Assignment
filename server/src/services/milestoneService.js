// Business rules for milestones.
//  - Only the owner PM or an admin can create/update.
//  - A milestone's due date must fall within the project's start and end dates.
//  - ACHIEVED milestones get a completion date; any other status clears it.
import { query, withTransaction } from '../db.js';
import { config } from '../config.js';
import { badRequest, notFound, staleVersion } from '../utils/errors.js';
import { getAccessibleProject, assertCanManageProject, addProjectScope } from '../utils/access.js';
import { createFilters, orderBy, pagination, pagedResult } from '../utils/listQuery.js';
import { logAudit } from './auditService.js';

export async function listMilestones(user, q) {
  const filters = createFilters();
  const asOf = filters.param(config.reportingDate);
  addProjectScope(filters, user, 'ms.project_id');
  if (q.projectId) filters.add('ms.project_id = ?', q.projectId);
  if (q.departmentId) filters.add('p.department_id = ?', q.departmentId);
  if (q.managerId) filters.add('p.owner_id = ?', q.managerId);
  if (q.status) filters.add('ms.status = ?', q.status);
  // "Due in the next N days" counts from the reporting date and ignores achieved milestones.
  if (q.dueWithinDays) {
    filters.add(`ms.status <> 'ACHIEVED' AND ms.due_date > ${asOf} AND ms.due_date <= ${asOf}::date + ?::int`, q.dueWithinDays);
  }

  const { page, pageSize, limitSql } = pagination(q);
  const { rows } = await query(
    `SELECT ms.*, p.code AS project_code, p.name AS project_name,
            (ms.status NOT IN ('ACHIEVED') AND ms.due_date < ${asOf}) AS is_late,
            COUNT(*) OVER() AS total_count
       FROM milestones ms
       JOIN projects p ON p.id = ms.project_id
       ${filters.where()}
       ${orderBy(q.sort, q.order, { due_date: 'ms.due_date', name: 'ms.name', status: 'ms.status' }, 'due_date')}
       ${limitSql}`,
    filters.params,
  );
  return pagedResult(rows, page, pageSize);
}

function checkDueDateWithinProject(project, dueDate) {
  if (dueDate < project.start_date || dueDate > project.end_date) {
    throw badRequest(`Milestone due date must be between the project dates (${project.start_date} to ${project.end_date}).`);
  }
}

function completionDate(status, existingDate) {
  if (status !== 'ACHIEVED') return null;
  return existingDate || new Date().toISOString().slice(0, 10);
}

export async function createMilestone(user, projectId, data, requestId) {
  return withTransaction(async (db) => {
    const project = await getAccessibleProject(user, projectId, db);
    assertCanManageProject(user, project);
    checkDueDateWithinProject(project, data.dueDate);
    const { rows } = await db.query(
      `INSERT INTO milestones (project_id, name, due_date, status, completed_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [projectId, data.name, data.dueDate, data.status, completionDate(data.status)],
    );
    await logAudit(db, { actorId: user.id, action: 'MILESTONE_CREATED', entityType: 'milestone', entityId: rows[0].id, details: data, requestId });
    return rows[0];
  });
}

export async function updateMilestone(user, milestoneId, data, requestId) {
  return withTransaction(async (db) => {
    const { rows: found } = await db.query('SELECT * FROM milestones WHERE id = $1', [milestoneId]);
    if (!found[0]) throw notFound('Milestone');
    const project = await getAccessibleProject(user, found[0].project_id, db);
    assertCanManageProject(user, project);
    checkDueDateWithinProject(project, data.dueDate);

    const { rows } = await db.query(
      `UPDATE milestones
          SET name = $1, due_date = $2, status = $3, completed_at = $4, version = version + 1, updated_at = now()
        WHERE id = $5 AND version = $6
        RETURNING *`,
      [data.name, data.dueDate, data.status, completionDate(data.status, found[0].completed_at), milestoneId, data.version],
    );
    if (!rows[0]) throw staleVersion();
    await logAudit(db, { actorId: user.id, action: 'MILESTONE_UPDATED', entityType: 'milestone', entityId: milestoneId, details: data, requestId });
    return rows[0];
  });
}
