// Builds the Express app. Kept separate from server.js so tests can import the app
// without starting a real server.
//
// Request flow:  requestId -> requestLogger -> JSON/cookies -> (requireAuth) -> route -> service -> database
//                                                     any error anywhere -> errorHandler
import express from 'express';
import cookieParser from 'cookie-parser';
import { query } from './db.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/authRoutes.js';
import { lookupRoutes } from './routes/lookupRoutes.js';
import { projectRoutes } from './routes/projectRoutes.js';
import { taskRoutes } from './routes/taskRoutes.js';
import { deliveryRoutes } from './routes/deliveryRoutes.js';
import { changeRequestRoutes } from './routes/changeRequestRoutes.js';
import { financeRoutes } from './routes/financeRoutes.js';
import { activityRoutes } from './routes/activityRoutes.js';

export const app = express();

app.disable('x-powered-by'); // don't advertise the framework
app.use(requestId);
app.use(requestLogger);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// ---- Public routes ----
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});
app.use('/api/auth', authRoutes);

// ---- Everything below requires a signed-in user ----
app.use('/api', requireAuth);
app.use('/api', lookupRoutes);
app.use('/api', projectRoutes);
app.use('/api', taskRoutes);
app.use('/api', deliveryRoutes);
app.use('/api', changeRequestRoutes);
app.use('/api', financeRoutes);
app.use('/api', activityRoutes);

app.use('/api', notFoundHandler);
app.use(errorHandler);
