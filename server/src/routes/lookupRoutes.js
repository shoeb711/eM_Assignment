// GET /api/lookups - small reference lists for dropdowns and filters
import { Router } from 'express';
import { query } from '../db.js';
import { config } from '../config.js';

export const lookupRoutes = Router();

lookupRoutes.get('/lookups', async (req, res) => {
  const [departments, users, categories] = await Promise.all([
    query('SELECT id, name FROM departments ORDER BY name'),
    query(`SELECT id, full_name, role, department_id FROM users WHERE is_active ORDER BY full_name`),
    query('SELECT id, name FROM cost_categories ORDER BY id'),
  ]);
  res.json({
    departments: departments.rows,
    users: users.rows,
    costCategories: categories.rows,
    reportingDate: config.reportingDate,
    highRiskScore: config.highRiskScore,
  });
});
