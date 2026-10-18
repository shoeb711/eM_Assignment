// Business rules for tasks.
//  - Project managers (owner) and admins can create and fully edit tasks.
//  - The assignee of a task may update ONLY its status and progress.
//  - A task is OVERDUE when it is not DONE and its due date is before the reporting date.
import { query, withTransaction } from '../db.js';
import { config } from '../config.js';
import { badRequest, forbidden, notFound, staleVersion } from '../utils/errors.js';
import { getAccessibleProject, assertCanManageProject, canManageProject, addProjectScope } from '../utils/access.js';
import { createFilters, orderBy, pagination, pagedResult } from '../utils/listQuery.js';
import { logAudit } from './auditService.js';

const SORTABLE = {
  due_date: 't.due_date', title: 't.title', status: 't.status', priority: 't.priority',
  progress: 't.progress', project: 'p.code', assignee: 'a.full_name',
};

export async function listTasks(user, q) {
  const filters = createFilters();
  const asOf = filters.param(config.reportingDate);
  addProjectScope(filters, user, 't.project_id');
  if (q.projectId) filters.add('t.project_id = ?', q.projectId);
  if (q.departmentId) filters.add('p.department_id = ?', q.departmentId);
  if (q.managerId) filters.add('p.owner_id = ?', q.managerId);
  if (q.assigneeId) filters.add('t.assignee_id = ?', q.assigneeId);
  if (q.mine) filters.add('t.assignee_id = ?', user.id);
  if (q.unassigned) filters.addFixed('t.assignee_id IS NULL');
  if (q.status) filters.add('t.status = ?', q.status);
  if (q.priority) filters.add('t.priority = ?', q.priority);
  if (q.overdue) filters.add(`t.status <> 'DONE' AND t.due_date < ?`, config.reportingDate);
  if (q.search) filters.add('t.title ILIKE ?', `%${q.search}%`);

  const { page, pageSize, limitSql } = pagination(q);
  const { rows } = await query(
    `SELECT t.id, t.project_id, p.code AS project_code, p.name AS project_name,
            t.title, t.status, t.priority, t.start_date, t.due_date, t.weight, t.progress, t.completed_at,
            t.assignee_id, a.full_name AS assignee_name, t.version,
            (t.status <> 'DONE' AND t.due_date < ${asOf}) AS is_overdue,
            (t.status <> 'DONE' AND t.due_date BETWEEN ${asOf} AND ${asOf}::date + 7) AS is_due_soon,
            COUNT(*) OVER() AS total_count
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users a ON a.id = t.assignee_id
       ${filters.where()}
       ${orderBy(q.sort, q.order, SORTABLE, 'due_date')}, t.id
       ${limitSql}`,
    filters.params,
  );
  return pagedResult(rows, page, pageSize);
}

async function getTaskRow(db, taskId) {
  const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  if (!rows[0]) throw notFound('Task');
  return rows[0];
}

export async function getTask(user, taskId) {
  const task = await getTaskRow({ query }, taskId);
  const project = await getAccessibleProject(user, task.project_id); // 404 if the user can't see the project
  return { ...task, canManage: canManageProject(user, project) };
}

async function assertAssigneeIsMember(db, projectId, assigneeId) {
  if (!assigneeId) return;
  const { rowCount } = await db.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, assigneeId],
  );
  if (rowCount === 0) throw badRequest('The assignee must be a member of this project.');
}

// Keeps status, progress and completion date consistent:
//   DONE  <=> progress 100 and a completion date.
function applyCompletionRules(task) {
  const today = new Date().toISOString().slice(0, 10);
  if (task.status === 'DONE' || task.progress === 100) {
    task.status = 'DONE';
    task.progress = 100;
    task.completed_at = task.completed_at || today;
  } else {
    task.completed_at = null;
  }
  return task;
}

export async function createTask(user, projectId, data, requestId) {
  return withTransaction(async (db) => {
    const project = await getAccessibleProject(user, projectId, db);
    assertCanManageProject(user, project);
    await assertAssigneeIsMember(db, projectId, data.assigneeId);

    const task = applyCompletionRules({ ...data, completed_at: null });
    const { rows } = await db.query(
      `INSERT INTO tasks (project_id, title, description, assignee_id, status, priority, start_date, due_date, weight, progress, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [projectId, task.title, task.description, task.assigneeId ?? null, task.status, task.priority,
        task.startDate ?? null, task.dueDate, task.weight, task.progress, task.completed_at],
    );
    await logAudit(db, { actorId: user.id, action: 'TASK_CREATED', entityType: 'task', entityId: rows[0].id, details: data, requestId });
    return rows[0].id;
  });
}

const CONTRIBUTOR_FIELDS = ['status', 'progress', 'version'];

export async function updateTask(user, taskId, changes, requestId) {
  return withTransaction(async (db) => {
    const existing = await getTaskRow(db, taskId);
    const project = await getAccessibleProject(user, existing.project_id, db);
    const isManager = canManageProject(user, project);
    const isAssignee = existing.assignee_id === user.id;

    if (!isManager) {
      if (!isAssignee) throw forbidden('You can only update tasks assigned to you.');
      const extraFields = Object.keys(changes).filter((f) => !CONTRIBUTOR_FIELDS.includes(f));
      if (extraFields.length) {
        throw forbidden(`You can only change the status and progress of your task (not: ${extraFields.join(', ')}).`);
      }
    }

    // Start from the saved task and apply only the fields that were sent.
    const task = applyCompletionRules({
      title: changes.title ?? existing.title,
      description: changes.description ?? existing.description,
      assigneeId: changes.assigneeId !== undefined ? changes.assigneeId : existing.assignee_id,
      status: changes.status ?? existing.status,
      priority: changes.priority ?? existing.priority,
      startDate: changes.startDate !== undefined ? changes.startDate : existing.start_date,
      dueDate: changes.dueDate ?? existing.due_date,
      weight: changes.weight ?? existing.weight,
      progress: changes.progress ?? existing.progress,
      completed_at: existing.completed_at,
    });
    // Moving a finished task back to an open status needs progress below 100.
    if (changes.status && changes.status !== 'DONE' && task.status === 'DONE') {
      throw badRequest('To reopen a task, also set its progress below 100%.');
    }
    if (task.startDate && task.dueDate < task.startDate) throw badRequest('Due date must be on or after the start date.');
    if (changes.assigneeId !== undefined) await assertAssigneeIsMember(db, existing.project_id, task.assigneeId);

    const { rowCount } = await db.query(
      `UPDATE tasks
          SET title = $1, description = $2, assignee_id = $3, status = $4, priority = $5, start_date = $6,
              due_date = $7, weight = $8, progress = $9, completed_at = $10,
              version = version + 1, updated_at = now()
        WHERE id = $11 AND version = $12`,
      [task.title, task.description, task.assigneeId, task.status, task.priority, task.startDate,
        task.dueDate, task.weight, task.progress, task.completed_at, taskId, changes.version],
    );
    if (rowCount === 0) throw staleVersion();

    await logAudit(db, { actorId: user.id, action: 'TASK_UPDATED', entityType: 'task', entityId: taskId, details: changes, requestId });
  });
}
