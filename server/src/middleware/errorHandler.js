// Turns ANY error into a predictable JSON response:
//   { "error": { "code": "...", "message": "...", "details": [...], "requestId": "..." } }
// Unexpected errors (500) are logged with their stack trace but never shown to the user.
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// PostgreSQL error codes -> friendly API errors
const PG_ERRORS = {
  23505: [409, 'DUPLICATE', 'A record with the same unique value already exists.'],
  23503: [400, 'INVALID_REFERENCE', 'A referenced record does not exist.'],
  23514: [400, 'RULE_VIOLATION', 'The data breaks a database rule.'],
  23502: [400, 'MISSING_VALUE', 'A required value is missing.'],
  '22P02': [400, 'INVALID_VALUE', 'A value has the wrong format.'],
  P0001: [409, 'RULE_VIOLATION', null], // raised by our own triggers - their message is already readable
};

export function errorHandler(err, req, res, next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong. Please try again or contact support with the request ID.';
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Some fields are missing or invalid.';
    details = err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request body is not valid JSON.';
  } else if (PG_ERRORS[err.code]) {
    const [pgStatus, pgCode, pgMessage] = PG_ERRORS[err.code];
    status = pgStatus;
    code = pgCode;
    message = pgMessage || err.message;
    details = err.constraint ? [{ constraint: err.constraint }] : undefined;
  }

  if (status >= 500) {
    logger.error('unhandled error', { requestId: req.id, error: err.message, stack: err.stack });
  }

  res.status(status).json({ error: { code, message, details, requestId: req.id } });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No API route for ${req.method} ${req.originalUrl}`, requestId: req.id },
  });
}
