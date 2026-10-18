// GET /api/dashboard - executive dashboard data (KPIs + chart data), scoped to the user's projects.
// Filters: departmentId, projectId, managerId, status (project lifecycle),
//          from / to (period for the trend & category charts), categoryId (finance charts only)
import { Router } from 'express';
import { z } from 'zod';
import * as dashboardService from '../services/dashboardService.js';
import { optionalId, dateString } from '../utils/schemas.js';

export const dashboardRoutes = Router();

const filterSchema = z.object({
  departmentId: optionalId,
  projectId: optionalId,
  managerId: optionalId,
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  categoryId: optionalId,
});

dashboardRoutes.get('/dashboard', async (req, res) => {
  res.json(await dashboardService.getDashboard(req.user, filterSchema.parse(req.query)));
});
