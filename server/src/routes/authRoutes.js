// POST /api/auth/login   - sign in, sets the session cookie
// POST /api/auth/logout  - clears the session cookie
// GET  /api/auth/me      - the signed-in user
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth, createSessionToken, sessionCookieOptions } from '../middleware/auth.js';
import * as authService from '../services/authService.js';

export const authRoutes = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});

authRoutes.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await authService.login(email, password, req.id);
  res.cookie(config.sessionCookieName, createSessionToken(user), sessionCookieOptions);
  res.json({ user });
});

authRoutes.post('/logout', (req, res) => {
  res.clearCookie(config.sessionCookieName, { ...sessionCookieOptions, maxAge: undefined });
  res.status(204).end();
});

authRoutes.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
