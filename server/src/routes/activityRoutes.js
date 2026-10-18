// GET  /api/notifications           - my in-app notifications (+ unread count)
// POST /api/notifications/:id/read  - mark one of MY notifications as read
// GET  /api/audit-events            - audit log (Admin only)
// GET  /api/automation-runs         - automation run history (Admin only)
// POST /api/automation-runs/run     - run the overdue-task automation now (Admin only)
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { notFound } from '../utils/errors.js';
import { id } from '../utils/schemas.js';
import { createFilters, pagination, pagedResult } from '../utils/listQuery.js';
import { runOverdueTaskAlerts } from '../jobs/overdueTaskAlerts.js';
import { logAudit } from '../services/auditService.js';

export const activityRoutes = Router();

activityRoutes.get('/notifications', async (req, res) => {
  const { rows } = await query(
    `SELECT n.id, n.type, n.title, n.message, n.is_read, n.created_at, n.project_id, p.code AS project_code
       FROM notifications n LEFT JOIN projects p ON p.id = n.project_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT 50`,
    [req.user.id],
  );
  res.json({ items: rows, unread: rows.filter((n) => !n.is_read).length });
});

activityRoutes.post('/notifications/:id/read', async (req, res) => {
  // "AND user_id = $2" means a user can never mark someone else's notification.
  const { rowCount } = await query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
    [id.parse(req.params.id), req.user.id],
  );
  if (rowCount === 0) throw notFound('Notification');
  res.status(204).end();
});

const auditListSchema = z.object({
  action: z.string().max(60).optional(),
  entityType: z.string().max(60).optional(),
  entityId: z.coerce.number().int().positive().optional(),
  actorId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

activityRoutes.get('/audit-events', requireRole('ADMIN'), async (req, res) => {
  const q = auditListSchema.parse(req.query);
  const filters = createFilters();
  if (q.action) filters.add('e.action = ?', q.action);
  if (q.entityType) filters.add('e.entity_type = ?', q.entityType);
  if (q.entityId) filters.add('e.entity_id = ?', q.entityId);
  if (q.actorId) filters.add('e.actor_id = ?', q.actorId);
  const { page, pageSize, limitSql } = pagination(q);
  const { rows } = await query(
    `SELECT e.id, e.action, e.entity_type, e.entity_id, e.details, e.request_id, e.created_at,
            u.full_name AS actor_name, COUNT(*) OVER() AS total_count
       FROM audit_events e LEFT JOIN users u ON u.id = e.actor_id
       ${filters.where()}
      ORDER BY e.created_at DESC, e.id DESC
      ${limitSql}`,
    filters.params,
  );
  res.json(pagedResult(rows, page, pageSize));
});

activityRoutes.get('/automation-runs', requireRole('ADMIN'), async (req, res) => {
  const { rows } = await query(
    `SELECT r.*, (SELECT COUNT(*) FROM notifications n WHERE n.automation_run_id = r.id) AS notifications_created
       FROM automation_runs r ORDER BY r.started_at DESC, r.id DESC LIMIT 50`,
  );
  res.json({ items: rows });
});

activityRoutes.post('/automation-runs/run', requireRole('ADMIN'), async (req, res) => {
  const { simulateFailure } = z.object({ simulateFailure: z.boolean().optional().default(false) }).parse(req.body ?? {});
  const result = await runOverdueTaskAlerts({ simulateFailure });
  await logAudit({ query }, {
    actorId: req.user.id, action: 'AUTOMATION_TRIGGERED', entityType: 'automation_run', entityId: result.runIds.at(-1),
    details: result, requestId: req.id,
  });
  res.json(result);
});
