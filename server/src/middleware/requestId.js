// Gives every request a unique ID (or reuses one sent by the caller in X-Request-Id).
// The ID is returned in the response header, written to every log line and stored on
// audit events, so one request can be traced end to end.
import { randomUUID } from 'node:crypto';

export function requestId(req, res, next) {
  const incoming = req.get('X-Request-Id');
  req.id = incoming && incoming.length <= 100 ? incoming : randomUUID();
  res.set('X-Request-Id', req.id);
  next();
}
