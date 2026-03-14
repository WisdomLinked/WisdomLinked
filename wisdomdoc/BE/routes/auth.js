import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db.js';

function parseMajors(s) {
  if (!s) return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a : [];
  } catch {
    return s.split(',').map(m => m.trim()).filter(Boolean);
  }
}

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = await queryOne('SELECT id, email, role, major, majors FROM users WHERE email = $1 AND password_hash = $2', [email, password]);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const role = user.role || 'student';
  res.json({
    user: { id: user.id, email: user.email, role, major: user.major, majors: parseMajors(user.majors) },
    token: `session-${user.id}-${Date.now()}`,
  });
});

router.post('/register', async (req, res) => {
  const { email, password, role, major, majors } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const userRole = role === 'expert' || role === 'committee' ? 'expert' : 'student';
  const maj = userRole === 'student' ? (major != null ? String(major).trim() : null) : null;
  const majs = userRole === 'expert' && Array.isArray(majors) ? JSON.stringify(majors) : (userRole === 'expert' && typeof majors === 'string' ? JSON.stringify(majors.split(',').map(m => m.trim()).filter(Boolean)) : null);
  try {
    await query(
      'INSERT INTO users (email, password_hash, role, major, majors) VALUES ($1, $2, $3, $4, $5)',
      [email, password, userRole, maj, majs]
    );
    const user = await queryOne('SELECT id, email, role, major, majors FROM users WHERE email = $1', [email]);
    res.status(201).json({
      user: { id: user.id, email: user.email, role: user.role || userRole, major: user.major, majors: parseMajors(user.majors) },
      token: `session-${user.id}-${Date.now()}`,
    });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw e;
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Email required' });
  }
  const em = String(email).trim().toLowerCase();
  const user = await queryOne('SELECT id FROM users WHERE email = $1', [em]);
  if (!user) {
    return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
  }
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await query('DELETE FROM password_reset_tokens WHERE email = $1', [em]);
  await query('INSERT INTO password_reset_tokens (email, token, expires_at) VALUES ($1, $2, $3)', [em, token, expiresAt]);
  res.json({ success: true, token, expiresAt });
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: 'Valid token and password (min 4 chars) required' });
  }
  const row = await queryOne('SELECT email, expires_at FROM password_reset_tokens WHERE token = $1', [token]);
  if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' });
  if (new Date(row.expires_at) < new Date()) {
    await query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
    return res.status(400).json({ error: 'Reset link has expired' });
  }
  await query('UPDATE users SET password_hash = $1 WHERE email = $2', [String(newPassword), row.email]);
  await query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
  res.json({ success: true, message: 'Password updated' });
});

export default router;
