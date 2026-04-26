import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

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

router.post('/login', (req, res) => {
  const email = req.body?.email != null ? String(req.body.email).trim().toLowerCase() : '';
  const password = req.body?.password != null ? String(req.body.password) : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = db.prepare('SELECT id, email, role, major, majors, timezone, username, bio, title, image, phone, country, state, city, target_year FROM users WHERE email = ? AND password_hash = ?').get(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const role = user.role || 'student';
  res.json({
    user: { id: user.id, email: user.email, role, major: user.major, majors: parseMajors(user.majors), timezone: user.timezone || 'America/Chicago', username: user.username, bio: user.bio, title: user.title, image: user.image, phone: user.phone, country: user.country, state: user.state, city: user.city, target_year: user.target_year != null ? Number(user.target_year) : null },
    token: `session-${user.id}-${Date.now()}`,
  });
});

const VALID_TIMEZONES = ['America/Chicago', 'America/New_York', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'UTC', 'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney'];

router.post('/register', (req, res) => {
  const email = req.body?.email != null ? String(req.body.email).trim().toLowerCase() : '';
  const password = req.body?.password != null ? String(req.body.password) : '';
  const { role, major, majors, timezone, username, bio, title, country, state, city, phone } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const userRole = role === 'expert' || role === 'committee' ? 'expert' : 'student';
  const maj = userRole === 'student' ? (major != null ? String(major).trim() : null) : null;
  const majs = userRole === 'expert' && Array.isArray(majors) ? JSON.stringify(majors) : (userRole === 'expert' && typeof majors === 'string' ? JSON.stringify(majors.split(',').map(m => m.trim()).filter(Boolean)) : null);
  const tz = timezone && VALID_TIMEZONES.includes(timezone) ? timezone : 'America/Chicago';
  const un = username != null ? String(username).trim().slice(0, 100) : null;
  if (userRole === 'expert' && bio != null) {
    const bioStr = String(bio).trim();
    if (bioStr.length > 0 && bioStr.length < 30) {
      return res.status(400).json({ error: 'Bio must be at least 30 characters' });
    }
  }
  const b = bio != null ? String(bio).trim().slice(0, 2000) : null;
  if (userRole === 'expert' && b && b.length < 30) {
    return res.status(400).json({ error: 'Bio must be at least 30 characters' });
  }
  const tt = title != null ? String(title).trim().slice(0, 200) : null;
  const ctry = country != null ? String(country).trim().slice(0, 100) : null;
  const st = state != null ? String(state).trim().slice(0, 100) : null;
  const cty = city != null ? String(city).trim().slice(0, 100) : null;
  const ph = phone != null ? String(phone).trim().slice(0, 30) : null;
  try {
    db.prepare('INSERT INTO users (email, password_hash, role, major, majors, timezone, username, bio, title, country, state, city, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(email, password, userRole, maj, majs, tz, un || null, b || null, tt || null, ctry || null, st || null, cty || null, ph || null);
    const user = db.prepare('SELECT id, email, role, major, majors, timezone, username, bio, title, image, phone, country, state, city, target_year FROM users WHERE email = ?').get(email);
    res.status(201).json({
      user: { id: user.id, email: user.email, role: user.role || userRole, major: user.major, majors: parseMajors(user.majors), timezone: user.timezone || 'America/Chicago', username: user.username, bio: user.bio, title: user.title, image: user.image, phone: user.phone, country: user.country, state: user.state, city: user.city, target_year: user.target_year != null ? Number(user.target_year) : null },
      token: `session-${user.id}-${Date.now()}`,
    });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw e;
  }
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Email required' });
  }
  const em = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(em);
  if (!user) {
    return res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
  }
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM password_reset_tokens WHERE email = ?').run(em);
  db.prepare('INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (?, ?, ?)').run(em, token, expiresAt);
  res.json({ success: true, token, expiresAt });
});

router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: 'Valid token and password (min 4 chars) required' });
  }
  const row = db.prepare('SELECT email, expires_at FROM password_reset_tokens WHERE token = ?').get(token);
  if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' });
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM password_reset_tokens WHERE token = ?').run(token);
    return res.status(400).json({ error: 'Reset link has expired' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(String(newPassword), row.email);
  db.prepare('DELETE FROM password_reset_tokens WHERE token = ?').run(token);
  res.json({ success: true, message: 'Password updated' });
});

/** Simple reset (no token): email + new password — for internal / demo use */
router.post('/reset-password-simple', (req, res) => {
  const email = req.body?.email != null ? String(req.body.email).trim().toLowerCase() : '';
  const newPassword = req.body?.newPassword != null ? String(req.body.newPassword) : '';
  if (!email || !newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Email and password (min 4 chars) required' });
  }
  const result = db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(newPassword, email);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'No account found for that email' });
  }
  res.json({ success: true, message: 'Password updated' });
});

router.get('/me', authMiddleware, (req, res) => {
  const u = db.prepare('SELECT id, email, role, major, majors, timezone, username, bio, title, image, phone, country, state, city, created_at, target_year FROM users WHERE id = ?').get(req.userId);
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: u.id,
    email: u.email,
    role: u.role || 'student',
    major: u.major,
    majors: parseMajors(u.majors),
    timezone: u.timezone || 'America/Chicago',
    username: u.username,
    bio: u.bio,
    title: u.title,
    image: u.image,
    phone: u.phone,
    country: u.country,
    state: u.state,
    city: u.city,
    created_at: u.created_at,
    target_year: u.target_year != null ? Number(u.target_year) : null,
  });
});

router.patch('/me', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const role = row.role || 'student';
  if (req.body.email !== undefined && String(req.body.email).trim().toLowerCase() !== String(row.email).trim().toLowerCase()) {
    return res.status(400).json({ error: 'Email cannot be changed; it is your login identifier' });
  }

  const sets = [];
  const vals = [];

  function pushSet(column, value) {
    sets.push(`${column} = ?`);
    vals.push(value);
  }

  if (req.body.username !== undefined) {
    pushSet('username', req.body.username === null || req.body.username === '' ? null : String(req.body.username).trim().slice(0, 100));
  }
  if (req.body.bio !== undefined) {
    const b = req.body.bio === null || req.body.bio === '' ? null : String(req.body.bio).trim().slice(0, 2000);
    if ((role === 'expert' || role === 'admin') && b && b.length < 30) {
      return res.status(400).json({ error: 'Bio must be at least 30 characters' });
    }
    pushSet('bio', b);
  }
  if (req.body.title !== undefined) {
    pushSet('title', req.body.title === null || req.body.title === '' ? null : String(req.body.title).trim().slice(0, 200));
  }
  ['phone', 'country', 'state', 'city'].forEach((field) => {
    if (req.body[field] !== undefined) {
      const max = field === 'phone' ? 30 : 100;
      const v = req.body[field];
      pushSet(field, v === null || v === '' ? null : String(v).trim().slice(0, max));
    }
  });

  if (req.body.timezone !== undefined) {
    const tz = req.body.timezone;
    if (tz === null || tz === '') {
      pushSet('timezone', 'America/Chicago');
    } else if (!VALID_TIMEZONES.includes(tz)) {
      return res.status(400).json({ error: 'Invalid timezone' });
    } else {
      pushSet('timezone', tz);
    }
  }

  if (role === 'student') {
    if (req.body.major !== undefined) {
      pushSet('major', req.body.major === null || req.body.major === '' ? null : String(req.body.major).trim());
    }
    if (req.body.target_year !== undefined) {
      if (req.body.target_year === null || req.body.target_year === '') {
        pushSet('target_year', null);
      } else {
        const y = parseInt(String(req.body.target_year), 10);
        if (Number.isNaN(y) || y < 2000 || y > 2100) {
          return res.status(400).json({ error: 'Target year must be between 2000 and 2100' });
        }
        pushSet('target_year', y);
      }
    }
  }

  if (role === 'expert' || role === 'admin') {
    if (req.body.majors !== undefined) {
      const arr = Array.isArray(req.body.majors)
        ? req.body.majors.map((m) => String(m).trim()).filter(Boolean)
        : String(req.body.majors || '')
          .split(/[,\n]/)
          .map((m) => m.trim())
          .filter(Boolean);
      pushSet('majors', JSON.stringify(arr));
    }
  }

  if (sets.length > 0) {
    vals.push(req.userId);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  const out = db.prepare('SELECT id, email, role, major, majors, timezone, username, bio, title, image, phone, country, state, city, created_at, target_year FROM users WHERE id = ?').get(req.userId);
  res.json({
    id: out.id,
    email: out.email,
    role: out.role || 'student',
    major: out.major,
    majors: parseMajors(out.majors),
    timezone: out.timezone || 'America/Chicago',
    username: out.username,
    bio: out.bio,
    title: out.title,
    image: out.image,
    phone: out.phone,
    country: out.country,
    state: out.state,
    city: out.city,
    created_at: out.created_at,
    target_year: out.target_year != null ? Number(out.target_year) : null,
  });
});

export default router;
