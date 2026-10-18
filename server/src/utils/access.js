// Project-level access rules (used by every service).
//
//   ADMIN            -> can see and manage every project
//   PROJECT_MANAGER  -> can see projects they own or are a member of; can MANAGE only projects they own
//   CONTRIBUTOR      -> can see projects they are a member of; cannot manage
//
// A project the user may not see is reported as "not found" (404), so IDs of other
// projects cannot even be discovered by guessing (prevents ID-based escalation).
import { query } from '../db.js';
import { notFound, forbidden } from './errors.js';

export async function getAccessibleProject(user, projectId, db = { query }) {
  const { rows } = await db.query(
    `SELECT p.*,
            EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = $2) AS is_member
       FROM projects p
      WHERE p.id = $1`,
    [projectId, user.id],
  );
  const project = rows[0];
  if (!project) throw notFound('Project');
  if (user.role !== 'ADMIN' && !project.is_member) throw notFound('Project');
  return project;
}

export function canManageProject(user, project) {
  return user.role === 'ADMIN' || (user.role === 'PROJECT_MANAGER' && project.owner_id === user.id);
}

export function assertCanManageProject(user, project) {
  if (!canManageProject(user, project)) {
    throw forbidden('Only the project manager who owns this project, or an administrator, can do this.');
  }
}

// Adds "only projects this user can see" to a list query (no-op for admins).
// `projectIdColumn` is the SQL column holding the project id, e.g. 'p.id' or 't.project_id'.
export function addProjectScope(filters, user, projectIdColumn) {
  if (user.role === 'ADMIN') return;
  filters.add(
    `EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = ${projectIdColumn} AND m.user_id = ?)`,
    user.id,
  );
}
