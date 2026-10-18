// Minimal structured logger: one JSON line per event, written to the console
// and to server/logs/app.log. Every request line carries a requestId so a failure
// reported by a user ("Request ID: abc-123") can be found in the log.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const logDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = fs.createWriteStream(path.join(logDir, 'app.log'), { flags: 'a' });

function write(level, message, fields = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
  logFile.write(`${line}\n`);
  if (!config.isTest) (level === 'error' ? console.error : console.log)(line);
}

export const logger = {
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields),
};
