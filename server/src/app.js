// Builds the Express app (routes + middleware). Kept separate from server.js
// so tests can import the app without starting a real server.
import express from 'express';
import { query } from './db.js';

export const app = express();

app.use(express.json());

// Health check: confirms the API is running AND can reach PostgreSQL.
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'unreachable', message: err.message });
  }
});
