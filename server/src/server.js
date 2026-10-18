// Entry point: starts the HTTP server and the automation schedule (settings come from server/.env via config.js).
import { config } from './config.js';
import { app } from './app.js';
import { logger } from './utils/logger.js';
import { scheduleOverdueTaskAlerts } from './jobs/overdueTaskAlerts.js';

app.listen(config.port, () => {
  logger.info(`API running on http://localhost:${config.port}`, { reportingDate: config.reportingDate });
});

if (config.automationIntervalMinutes > 0) {
  scheduleOverdueTaskAlerts(config.automationIntervalMinutes);
  logger.info(`Overdue-task automation scheduled every ${config.automationIntervalMinutes} min`);
}
