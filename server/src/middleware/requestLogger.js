// Logs one line per finished request: method, path, status, duration, user and request ID.
import { logger } from '../utils/logger.js';

export function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const fields = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?.id,
    };
    if (res.statusCode >= 500) logger.error('request failed', fields);
    else if (res.statusCode >= 400) logger.warn('request rejected', fields);
    else logger.info('request', fields);
  });
  next();
}
