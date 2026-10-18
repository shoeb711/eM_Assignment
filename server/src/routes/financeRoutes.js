// GET    /api/projects/:projectId/finance            - summary, alerts, by-category, monthly trend, revisions, forecasts
// GET    /api/costs                                  - list cost transactions (filters; returns totalAmount)
// POST   /api/projects/:projectId/costs              - create draft or posted cost (owner PM, Admin) - supports Idempotency-Key header
// POST   /api/costs/:id/post                         - post a draft cost (owner PM, Admin)
// PUT    /api/costs/:id                              - edit a DRAFT cost (owner PM, Admin)
// DELETE /api/costs/:id                              - delete a DRAFT cost (owner PM, Admin)
// POST   /api/projects/:projectId/budget-revisions   - request a budget revision (owner PM, Admin)
// POST   /api/budget-revisions/:id/decision          - approve/reject a revision (Admin only, not own request)
// PUT    /api/projects/:projectId/forecasts          - save monthly forecasts (owner PM, Admin)
import { Router } from 'express';
import { z } from 'zod';
import * as financeService from '../services/financeService.js';
import { id, optionalId, dateString, positiveMoney, text } from '../utils/schemas.js';

export const financeRoutes = Router();

const costSchema = z.object({
  categoryId: id,
  description: text(3, 300),
  amount: positiveMoney,
  txnDate: dateString,
  post: z.boolean().optional().default(false),
});

const costListSchema = z.object({
  projectId: optionalId,
  departmentId: optionalId,
  managerId: optionalId,
  categoryId: optionalId,
  status: z.enum(['DRAFT', 'POSTED']).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM').optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const revisionSchema = z.object({
  amount: z.number().refine((v) => v !== 0, 'Amount cannot be zero').refine((v) => Math.abs(v) <= 100_000_000, 'Amount too large'),
  reason: text(5, 1000),
  changeRequestId: id.nullable().optional(),
});

const forecastSchema = z.object({
  items: z.array(z.object({ month: dateString, amount: z.number().min(0).max(100_000_000) })).min(1).max(36),
});

financeRoutes.get('/projects/:projectId/finance', async (req, res) => {
  const asOf = dateString.optional().parse(req.query.asOf);
  res.json(await financeService.getProjectFinance(req.user, id.parse(req.params.projectId), asOf));
});

financeRoutes.get('/costs', async (req, res) => {
  res.json(await financeService.listCosts(req.user, costListSchema.parse(req.query)));
});

financeRoutes.post('/projects/:projectId/costs', async (req, res) => {
  const idempotencyKey = z.string().max(100).optional().parse(req.get('Idempotency-Key'));
  const result = await financeService.createCost(req.user, id.parse(req.params.projectId), costSchema.parse(req.body), idempotencyKey, req.id);
  res.status(result.replayed ? 200 : 201).json(result);
});

financeRoutes.post('/costs/:id/post', async (req, res) => {
  await financeService.postCost(req.user, id.parse(req.params.id), req.id);
  res.json({ id: Number(req.params.id), status: 'POSTED' });
});

financeRoutes.put('/costs/:id', async (req, res) => {
  await financeService.updateDraftCost(req.user, id.parse(req.params.id), costSchema.omit({ post: true }).parse(req.body), req.id);
  res.json({ id: Number(req.params.id) });
});

financeRoutes.delete('/costs/:id', async (req, res) => {
  await financeService.deleteDraftCost(req.user, id.parse(req.params.id), req.id);
  res.status(204).end();
});

financeRoutes.post('/projects/:projectId/budget-revisions', async (req, res) => {
  const revisionId = await financeService.requestBudgetRevision(req.user, id.parse(req.params.projectId), revisionSchema.parse(req.body), req.id);
  res.status(201).json({ id: revisionId, status: 'PENDING' });
});

financeRoutes.post('/budget-revisions/:id/decision', async (req, res) => {
  const { decision } = z.object({ decision: z.enum(['APPROVE', 'REJECT']) }).parse(req.body);
  await financeService.decideBudgetRevision(req.user, id.parse(req.params.id), { decision }, req.id);
  res.json({ id: Number(req.params.id), status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED' });
});

financeRoutes.put('/projects/:projectId/forecasts', async (req, res) => {
  const { items } = forecastSchema.parse(req.body);
  await financeService.saveForecasts(req.user, id.parse(req.params.projectId), items, req.id);
  res.json({ saved: items.length });
});
