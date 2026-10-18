// GET  /api/tasks                       - list across visible projects (filters: project, assignee, status, overdue, ...)
// GET  /api/tasks/:id                   - one task
// POST /api/projects/:projectId/tasks   - create (owner PM, Admin)
// PUT  /api/tasks/:id                   - update; assignees may change only status + progress
import { Router } from 'express';
import { z } from 'zod';
import * as taskService from '../services/taskService.js';
import { id, optionalId, optionalBool, dateString, version, text } from '../utils/schemas.js';

export const taskRoutes = Router();

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const listSchema = z.object({
  projectId: optionalId,
  departmentId: optionalId,
  managerId: optionalId,
  projectStatus: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  assigneeId: optionalId,
  mine: optionalBool,
  unassigned: optionalBool,
  overdue: optionalBool,
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const taskFields = {
  title: text(3, 200),
  description: z.string().trim().max(2000).nullable(),
  assigneeId: id.nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  startDate: dateString.nullable(),
  dueDate: dateString,
  weight: z.number().int().min(1).max(10),
  progress: z.number().int().min(0).max(100),
};

const createSchema = z
  .object({
    ...taskFields,
    description: taskFields.description.optional().default(null),
    assigneeId: taskFields.assigneeId.optional().default(null),
    startDate: taskFields.startDate.optional().default(null),
    weight: taskFields.weight.optional().default(1),
    progress: taskFields.progress.optional().default(0),
    status: taskFields.status.optional().default('TODO'),
  })
  .refine((t) => !t.startDate || t.dueDate >= t.startDate, { message: 'Due date must be on or after the start date', path: ['dueDate'] });

// Every field is optional on update except version; .strict() rejects unknown fields.
const updateSchema = z.object({ ...taskFields, version }).partial().required({ version: true }).strict();

taskRoutes.get('/tasks', async (req, res) => {
  res.json(await taskService.listTasks(req.user, listSchema.parse(req.query)));
});

taskRoutes.get('/tasks/:id', async (req, res) => {
  res.json(await taskService.getTask(req.user, id.parse(req.params.id)));
});

taskRoutes.post('/projects/:projectId/tasks', async (req, res) => {
  const taskId = await taskService.createTask(req.user, id.parse(req.params.projectId), createSchema.parse(req.body), req.id);
  res.status(201).json(await taskService.getTask(req.user, taskId));
});

taskRoutes.put('/tasks/:id', async (req, res) => {
  const taskId = id.parse(req.params.id);
  await taskService.updateTask(req.user, taskId, updateSchema.parse(req.body), req.id);
  res.json(await taskService.getTask(req.user, taskId));
});
