// Milestones and risks/issues
// GET  /api/milestones                       - list (filters: project, status, dueWithinDays)
// POST /api/projects/:projectId/milestones   - create (owner PM, Admin)
// PUT  /api/milestones/:id                   - update, needs version (owner PM, Admin)
// GET  /api/risks                            - list (filters: project, type, status, open, highExposure)
// POST /api/projects/:projectId/risks        - create (owner PM, Admin)
// PUT  /api/risks/:id                        - update, needs version (owner PM, Admin)
import { Router } from 'express';
import { z } from 'zod';
import * as milestoneService from '../services/milestoneService.js';
import * as riskService from '../services/riskService.js';
import { id, optionalId, optionalBool, dateString, version, text } from '../utils/schemas.js';

export const deliveryRoutes = Router();

const paging = {
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
};

// ---------- Milestones ----------
const MILESTONE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'ACHIEVED', 'MISSED'];

const milestoneListSchema = z.object({
  projectId: optionalId,
  departmentId: optionalId,
  managerId: optionalId,
  status: z.enum(MILESTONE_STATUSES).optional(),
  dueWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  ...paging,
});

const milestoneSchema = z.object({
  name: text(3, 150),
  dueDate: dateString,
  status: z.enum(MILESTONE_STATUSES),
});

deliveryRoutes.get('/milestones', async (req, res) => {
  res.json(await milestoneService.listMilestones(req.user, milestoneListSchema.parse(req.query)));
});

deliveryRoutes.post('/projects/:projectId/milestones', async (req, res) => {
  const milestone = await milestoneService.createMilestone(req.user, id.parse(req.params.projectId), milestoneSchema.parse(req.body), req.id);
  res.status(201).json(milestone);
});

deliveryRoutes.put('/milestones/:id', async (req, res) => {
  const data = milestoneSchema.extend({ version }).parse(req.body);
  res.json(await milestoneService.updateMilestone(req.user, id.parse(req.params.id), data, req.id));
});

// ---------- Risks & issues ----------
const RISK_STATUSES = ['OPEN', 'MITIGATING', 'CLOSED'];
const RISK_TYPES = ['RISK', 'ISSUE'];
const oneToFive = z.number().int().min(1).max(5);

const riskListSchema = z.object({
  projectId: optionalId,
  departmentId: optionalId,
  managerId: optionalId,
  type: z.enum(RISK_TYPES).optional(),
  status: z.enum(RISK_STATUSES).optional(),
  open: optionalBool,
  highExposure: optionalBool,
  probability: z.coerce.number().int().min(1).max(5).optional(),
  impact: z.coerce.number().int().min(1).max(5).optional(),
  ...paging,
});

const riskSchema = z.object({
  type: z.enum(RISK_TYPES),
  title: text(3, 200),
  description: z.string().trim().max(2000).nullable().optional().default(null),
  ownerId: id.nullable().optional().default(null),
  probability: oneToFive,
  impact: oneToFive,
  mitigation: z.string().trim().max(2000).nullable().optional().default(null),
  dueDate: dateString.nullable().optional().default(null),
  status: z.enum(RISK_STATUSES),
});

deliveryRoutes.get('/risks', async (req, res) => {
  res.json(await riskService.listRisks(req.user, riskListSchema.parse(req.query)));
});

deliveryRoutes.post('/projects/:projectId/risks', async (req, res) => {
  const risk = await riskService.createRisk(req.user, id.parse(req.params.projectId), riskSchema.parse(req.body), req.id);
  res.status(201).json(risk);
});

deliveryRoutes.put('/risks/:id', async (req, res) => {
  const data = riskSchema.extend({ version }).parse(req.body);
  res.json(await riskService.updateRisk(req.user, id.parse(req.params.id), data, req.id));
});
