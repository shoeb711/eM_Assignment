import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { unauthorized } from '../utils/errors.js';
import { logAudit } from './auditService.js';

// Checks email + password. The same message is used for "no such user" and "wrong password"
// so an attacker cannot find out which emails exist.
export async function login(email, password, requestId) {
  const { rows } = await query(
    `SELECT id, full_name, email, role, department_id, is_active, password_hash FROM users WHERE email = $1`,
    [email],
  );
  const user = rows[0];
  const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !passwordOk || !user.is_active) {
    await logAudit({ query }, {
      actorId: user?.id, action: 'LOGIN_FAILED', entityType: 'user', entityId: user?.id, details: { email }, requestId,
    });
    throw unauthorized('Invalid email or password.');
  }

  await logAudit({ query }, { actorId: user.id, action: 'LOGIN', entityType: 'user', entityId: user.id, requestId });
  const { password_hash, ...safeUser } = user;
  return safeUser;
}
