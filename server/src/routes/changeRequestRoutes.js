// GET  /api/change-requests                         - list (filters: project, status, mine)
// GET  /api/change-requests/:id                     - details + full history
// POST /api/projects/:projectId/change-requests     - submit (any project member)
// POST /api/change-requests/:id/decision            - APPROVE / REJECT / RETURN (owner PM or Admin, never own request)
// POST /api/change-requests/:id/resubmit            - re-submit a RETURNED request (original submitter)
import { Router } from 'express';
import { z } from 'zod';
import * as crService from '../services/changeRequestService.js';
import { id, optionalId, optionalBool, version, text } from '../utils/schemas.js';

export const changeRequestRoutes = Router();

const listSchema = z.object({
  projectId: optionalId,
  departmentId: optionalId,
  managerId: optionalId,
  status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED']).optional(),
  mine: optionalBool,
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const submitSchema = z.object({
  title: text(5, 200),
  description: text(10, 4000),
  costImpact: z.number().min(-100_000_000).max(100_000_000).default(0),
  scheduleImpactDays: z.number().int().min(-365).max(365).default(0),
});

const decisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'RETURN']),
  reason: text(5, 1000),
  version,
});

const resubmitSchema = submitSchema.omit({ title: true }).extend({
  comment: z.string().trim().max(1000).optional(),
  version,
});

changeRequestRoutes.get('/change-requests', async (req, res) => {
  res.json(await crService.listChangeRequests(req.user, listSchema.parse(req.query)));
});

changeRequestRoutes.get('/change-requests/:id', async (req, res) => {
  res.json(await crService.getChangeRequest(req.user, id.parse(req.params.id)));
});

changeRequestRoutes.post('/projects/:projectId/change-requests', async (req, res) => {
  const crId = await crService.submitChangeRequest(req.user, id.parse(req.params.projectId), submitSchema.parse(req.body), req.id);
  res.status(201).json(await crService.getChangeRequest(req.user, crId));
});

changeRequestRoutes.post('/change-requests/:id/decision', async (req, res) => {
  const crId = id.parse(req.params.id);
  await crService.decideChangeRequest(req.user, crId, decisionSchema.parse(req.body), req.id);
  res.json(await crService.getChangeRequest(req.user, crId));
});

changeRequestRoutes.post('/change-requests/:id/resubmit', async (req, res) => {
  const crId = id.parse(req.params.id);
  await crService.resubmitChangeRequest(req.user, crId, resubmitSchema.parse(req.body), req.id);
  res.json(await crService.getChangeRequest(req.user, crId));
});
