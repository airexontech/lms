const crypto = require('node:crypto');
const { get, run } = require('./db');

const SESSION_DAYS = 7;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const stored = Buffer.from(hash, 'hex');
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expires);
  return token;
}

function userFromRequest(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const s = get('SELECT * FROM sessions WHERE token = ?', token);
  if (!s) return null;
  if (s.expires_at < new Date().toISOString()) {
    run('DELETE FROM sessions WHERE token = ?', token);
    return null;
  }
  const user = get('SELECT id, name, email, phone, role, avatar_color, xp, streak, last_active_date, active FROM users WHERE id = ?', s.user_id);
  if (!user || !user.active) return null;
  user.token = token;
  return user;
}

function destroySession(token) {
  run('DELETE FROM sessions WHERE token = ?', token);
}

module.exports = { hashPassword, verifyPassword, createSession, userFromRequest, destroySession };
