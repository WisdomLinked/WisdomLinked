import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { query, queryOne, queryAll, uploadsDirPath } from '../db.js';
import { authMiddleware, requireStudent } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = uploadsDirPath;

const ALLOWED_TYPES = ['sop', 'lor', 'resume', 'transcript', 'additional'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname) || '.bin'}`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    if (allowed.some(e => ext === e)) return cb(null, true);
    cb(new Error('Only PDF, DOC, DOCX, TXT allowed'));
  },
});

const router = Router();

router.use(authMiddleware, requireStudent);

router.get('/', async (req, res) => {
  try {
    const user = await queryOne('SELECT approved FROM users WHERE id = $1', [req.userId]) || {};
    const isApproved = user && (user.approved === 1 || user.approved === true);
    let docs;
    try {
      docs = await queryAll(
        'SELECT id, type, filename, path, size, created_at, description, uploaded_by FROM documents WHERE user_id = $1 ORDER BY uploaded_by IS NULL DESC, created_at DESC',
        [req.userId]
      );
    } catch (_) {
      docs = await queryAll(
        'SELECT id, type, filename, path, size, created_at FROM documents WHERE user_id = $1 ORDER BY created_at DESC',
        [req.userId]
      );
    }
    const messages = await queryAll('SELECT id, message, created_at FROM messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [req.userId]);
    let clarifications = [];
    try {
      clarifications = await queryAll(`
        SELECT c.id, c.message, c.created_at, u.email AS from_email
        FROM clarifications c
        JOIN users u ON u.id = c.from_user_id
        WHERE c.student_id = $1
        ORDER BY c.created_at DESC
      `, [req.userId]);
    } catch (_) {}
    res.json({
      documents: docs,
      messages: messages || [],
      message: messages?.[0] || null,
      clarifications,
      isApproved: !!isApproved,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const user = await queryOne('SELECT approved FROM users WHERE id = $1', [req.userId]);
    if (!user || (user.approved !== 1 && user.approved !== true)) {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Only selected students can upload. Contact the committee.' });
    }
    const type = (req.body.type || '').toLowerCase();
    if (!ALLOWED_TYPES.includes(type)) {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid type.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const originalName = req.body.originalName || req.file.originalname || type;
    const description = type === 'additional' && req.body.description != null ? String(req.body.description).trim().slice(0, 200) : null;
    const r = await query(
      'INSERT INTO documents (user_id, type, filename, path, size, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, type, filename, path, size, created_at, description',
      [req.userId, type, originalName, req.file.filename, req.file.size, description]
    );
    const row = r.rows[0];
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/message', async (req, res) => {
  try {
    const user = await queryOne('SELECT approved FROM users WHERE id = $1', [req.userId]);
    if (!user || (user.approved !== 1 && user.approved !== true)) {
      return res.status(403).json({ error: 'Only selected students can add messages.' });
    }
    const message = req.body.message != null ? String(req.body.message).trim() : '';
    const r = await query(
      'INSERT INTO messages (user_id, message) VALUES ($1, $2) RETURNING id, message, created_at',
      [req.userId, message]
    );
    const row = r.rows[0];
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const doc = await queryOne('SELECT id, filename, path FROM documents WHERE id = $1 AND user_id = $2', [id, req.userId]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(uploadsDir, doc.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath, doc.filename);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await queryOne('SELECT id, path FROM documents WHERE id = $1 AND user_id = $2 AND uploaded_by IS NULL', [id, req.userId]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(uploadsDir, row.path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await query('DELETE FROM documents WHERE id = $1', [id]);
    res.json({ deleted: id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
