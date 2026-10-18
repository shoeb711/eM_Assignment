// Business rules for projects.
import { query, withTransaction } from '../db.js';
import { config } from '../config.js';
import { badRequest, staleVersion } from '../utils/errors.js';
import { getAccessibleProject, assertCanManageProject, canManageProject, addProjectScope } from '../utils/access.js';
import { createFilters, orderBy, pagination, pagedResult } from '../utils/listQuery.js';
import { logAudit } from './auditService.js';

// Project progress = weighted average of task progress (a task's weight says how much it counts).
//   progress % = SUM(weight x progress) / SUM(weight)
const PROGRESS_SQL = `
  LEFT JOIN LATERAL (
    SELECT ROUND(SUM(t.weight * t.progress)::numeric / NULLIF(SUM(t.weight), 0), 1) AS progress_pct,
           COUNT(*) FILTER (WHERE t.status <> 'DONE' AND t.due_date < $1) AS overdue_tasks
      FROM tasks t
     WHERE t.project_id = p.id
  ) prog ON TRUE`;

const SORTABLE = {
  code: 'p.code', name: 'p.name', status: 'p.status', start_date: 'p.start_date',
  end_date: 'p.end_date', initial_budget: 'p.initial_budget', progress: 'prog.progress_pct', owner: 'u.full_name',
};

export async function listProjects(user, q) {
  const filters = createFilters();
  filters.param(config.reportingDate); // $1 is used inside PROGRESS_SQL
  addProjectScope(filters, user, 'p.id');
  if (q.search) filters.add('(p.name ILIKE ? OR p.code ILIKE ?)', `%${q.search}%`);
  if (q.departmentId) filters.add('p.department_id = ?', q.departmentId);
  if (q.ownerId) filters.add('p.owner_id = ?', q.ownerId);
  if (q.status) filters.add('p.status = ?', q.status);
  if (q.startFrom) filters.add('p.start_date >= ?', q.startFrom);
  if (q.endTo) filters.add('p.end_date <= ?', q.endTo);

  const { page, pageSize, limitSql } = pagination(q);
  const { rows } = await query(
    `SELECT p.id, p.code, p.name, p.status, p.start_date, p.end_date, p.initial_budget,
            p.department_id, d.name AS department_name, p.owner_id, u.full_name AS owner_name,
            COALESCE(prog.progress_pct, 0) AS progress_pct, COALESCE(prog.overdue_tasks, 0) AS overdue_tasks,
            COUNT(*) OVER() AS total_count
       FROM projects p
       JOIN departments d ON d.id = p.department_id
       JOIN users u ON u.id = p.owner_id
       ${PROGRESS_SQL}
       ${filters.where()}
       ${orderBy(q.sort, q.order, SORTABLE, 'code')}
       ${limitSql}`,
    filters.params,
  );
  return pagedResult(rows, page, pageSize);
}

export async function getProject(user, projectId) {
  await getAccessibleProject(user, projectId);
  const { rows } = await query(
    `SELECT p.*, d.name AS department_name, u.full_name AS owner_name,
            COALESCE(prog.progress_pct, 0) AS progress_pct,
            COALESCE(prog.overdue_tasks, 0) AS overdue_tasks,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total_tasks,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'DONE') AS done_tasks,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'BLOCKED') AS blocked_tasks,
            (SELECT COUNT(*) FROM risks r WHERE r.project_id = p.id AND r.status <> 'CLOSED') AS open_risks,
            (SELECT COUNT(*) FROM risks r WHERE r.project_id = p.id AND r.status <> 'CLOSED' AND r.score >= $3) AS high_risks,
            (SELECT COUNT(*) FROM change_requests c WHERE c.project_id = p.id AND c.status = 'SUBMITTED') AS pending_change_requests
       FROM projects p
       JOIN departments d ON d.id = p.department_id
       JOIN users u ON u.id = p.owner_id
       ${PROGRESS_SQL}
      WHERE p.id = $2`,
    [config.reportingDate, projectId, config.highRiskScore],
  );
  const members = await query(
    `SELECT u.id, u.full_name, u.role FROM project_members m JOIN users u ON u.id = m.user_id
      WHERE m.project_id = $1 ORDER BY u.full_name`,
    [projectId],
  );
  return { ...rows[0], members: members.rows, canManage: canManageProject(user, rows[0]) };
}

// The owner must be an active project manager (or admin).
async function assertValidOwner(db, ownerId) {
  const { rows } = await db.query('SELECT role, is_active FROM users WHERE id = $1', [ownerId]);
  if (!rows[0] || !rows[0].is_active || !['PROJECT_MANAGER', 'ADMIN'].includes(rows[0].role)) {
    throw badRequest('The project owner must be an active project manager.');
  }
}

async function saveMembers(db, projectId, ownerId, memberIds = []) {
  const ids = [...new Set([ownerId, ...memberIds])];
  await db.query('DELETE FROM project_members WHERE project_id = $1', [projectId]);
  await db.query(
    `INSERT INTO project_members (project_id, user_id) SELECT $1, UNNEST($2::int[])`,
    [projectId, ids],
  );
}

export async function createProject(user, data, requestId) {
  return withTransaction(async (db) => {
    await assertValidOwner(db, data.ownerId);
    const { rows } = await db.query(
      `INSERT INTO projects (code, name, description, department_id, owner_id, status, start_date, end_date, initial_budget)
       VALUES ('NEW-' || gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [data.name, data.description, data.departmentId, data.ownerId, data.status, data.startDate, data.endDate, data.initialBudget],
    );
    const projectId = rows[0].id;
    // The readable code (PRJ-011, ...) is based on the new id.
    await db.query(`UPDATE projects SET code = 'PRJ-' || LPAD(id::text, 3, '0') WHERE id = $1`, [projectId]);
    // The creator is added as a member so a PM who assigns another owner can still see the project.
    await saveMembers(db, projectId, data.ownerId, [user.id, ...(data.memberIds || [])]);
    await logAudit(db, { actorId: user.id, action: 'PROJECT_CREATED', entityType: 'project', entityId: projectId, details: data, requestId });
    return projectId;
  });
}

export async function updateProject(user, projectId, data, requestId) {
  return withTransaction(async (db) => {
    const project = await getAccessibleProject(user, projectId, db);
    assertCanManageProject(user, project);
    await assertValidOwner(db, data.ownerId);

    // Optimistic locking: only update if nobody changed the row since the client loaded it.
    const { rowCount } = await db.query(
      `UPDATE projects
          SET name = $1, description = $2, department_id = $3, owner_id = $4, status = $5,
              start_date = $6, end_date = $7, initial_budget = $8,
              version = version + 1, updated_at = now()
        WHERE id = $9 AND version = $10`,
      [data.name, data.description, data.departmentId, data.ownerId, data.status,
        data.startDate, data.endDate, data.initialBudget, projectId, data.version],
    );
    if (rowCount === 0) throw staleVersion();

    if (data.memberIds) await saveMembers(db, projectId, data.ownerId, data.memberIds);
    await logAudit(db, { actorId: user.id, action: 'PROJECT_UPDATED', entityType: 'project', entityId: projectId, details: data, requestId });
  });
}
