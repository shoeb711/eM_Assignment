// Authentication (who are you?) and role checks (what may you do?).
//
// Login puts a signed JWT in an httpOnly cookie:
//   - httpOnly: JavaScript in the browser cannot read it (protects against token theft via XSS)
//   - sameSite=lax: the browser won't send it on cross-site form posts (CSRF protection)
//   - secure: only sent over HTTPS in production
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { unauthorized, forbidden } from '../utils/errors.js';

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  maxAge: config.sessionHours * 60 * 60 * 1000,
};

export function createSessionToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: `${config.sessionHours}h` });
}

// Every protected route runs this first. It verifies the token AND reloads the user from the
// database, so a deactivated user or a changed role takes effect immediately.
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[config.sessionCookieName];
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }

  const { rows } = await query(
    `SELECT id, full_name, email, role, department_id, is_active FROM users WHERE id = $1`,
    [payload.sub],
  );
  const user = rows[0];
  if (!user || !user.is_active) throw unauthorized();

  req.user = user;
  next();
}

// Usage: router.post('/x', requireRole('PROJECT_MANAGER', 'ADMIN'), handler)
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw forbidden(`This action requires one of these roles: ${roles.join(', ')}.`);
    }
    next();
  };
}
