// GET  /api/projects        - list (search, filters, sort, pagination)
// GET  /api/projects/:id    - details + members + delivery stats
// POST /api/projects        - create            (Project Manager, Admin)
// PUT  /api/projects/:id    - edit, needs version (owner PM, Admin)
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import * as projectService from '../services/projectService.js';
import { id, dateString, version, text } from '../utils/schemas.js';

export const projectRoutes = Router();

const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  departmentId: id.optional(),
  ownerId: id.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  startFrom: dateString.optional(),
  endTo: dateString.optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const projectSchema = z
  .object({
    name: text(3, 150),
    description: z.string().trim().max(2000).optional().default(''),
    departmentId: id,
    ownerId: id,
    status: z.enum(PROJECT_STATUSES),
    startDate: dateString,
    endDate: dateString,
    initialBudget: z.number().min(0, 'Budget cannot be negative').max(100_000_000),
    memberIds: z.array(id).max(50).optional(),
  })
  .refine((p) => p.endDate >= p.startDate, { message: 'End date must be on or after the start date', path: ['endDate'] });

projectRoutes.get('/projects', async (req, res) => {
  res.json(await projectService.listProjects(req.user, listSchema.parse(req.query)));
});

projectRoutes.get('/projects/:id', async (req, res) => {
  res.json(await projectService.getProject(req.user, id.parse(req.params.id)));
});

projectRoutes.post('/projects', requireRole('PROJECT_MANAGER', 'ADMIN'), async (req, res) => {
  const projectId = await projectService.createProject(req.user, projectSchema.parse(req.body), req.id);
  res.status(201).json(await projectService.getProject(req.user, projectId));
});

projectRoutes.put('/projects/:id', requireRole('PROJECT_MANAGER', 'ADMIN'), async (req, res) => {
  const projectId = id.parse(req.params.id);
  const data = projectSchema.and(z.object({ version })).parse(req.body);
  await projectService.updateProject(req.user, projectId, data, req.id);
  res.json(await projectService.getProject(req.user, projectId));
});
