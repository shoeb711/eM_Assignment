// Entry point: starts the HTTP server (settings come from server/.env via config.js).
import { config } from './config.js';
import { app } from './app.js';
import { logger } from './utils/logger.js';

app.listen(config.port, () => {
  logger.info(`API running on http://localhost:${config.port}`, { reportingDate: config.reportingDate });
});
