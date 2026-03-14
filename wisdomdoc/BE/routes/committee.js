import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { query, queryOne, queryAll, uploadsDirPath } from '../db.js';
import { authMiddleware, requireCommittee } from '../middleware/auth.js';
import { majorMatches } from '../utils/majorMatch.js';
import { sendClarificationEmail } from '../utils/email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = uploadsDirPath;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const feedbackStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname) || '.bin'}`),
});
const feedbackUpload = multer({
  storage: feedbackStorage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    if (['.pdf', '.doc', '.docx', '.txt'].includes(ext)) return cb(null, true);
    cb(new Error('Only PDF, DOC, DOCX, TXT allowed'));
  },
});

function parseMajors(s) {
  if (!s) return [];
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch { return s.split(',').map(m => m.trim()).filter(Boolean); }
}

const router = Router();

router.use(authMiddleware, requireCommittee);

router.get('/students', async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin';
    let students;
    if (isAdmin) {
      students = await queryAll(`
        SELECT u.id, u.email, u.major, u.created_at, COALESCE(u.approved, 0) AS approved,
               (SELECT COUNT(*) FROM documents d WHERE d.user_id = u.id) AS doc_count,
               (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) AS message_count
        FROM users u
        WHERE u.role = 'student'
        ORDER BY u.created_at DESC
      `);
    } else {
      const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
      if (expertMajors.length === 0) {
        students = [];
      } else {
        const allStudents = await queryAll(`
          SELECT u.id, u.email, u.major, u.created_at, COALESCE(u.approved, 0) AS approved,
                 (SELECT COUNT(*) FROM documents d WHERE d.user_id = u.id) AS doc_count,
                 (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) AS message_count
          FROM users u
          WHERE u.role = 'student' AND COALESCE(u.major,'') != ''
          ORDER BY u.created_at DESC
        `);
        students = allStudents.filter(s => majorMatches(s.major, expertMajors));
      }
    }
    res.json({ students });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/students/approve-all', async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin';
    if (isAdmin) {
      const result = await query('UPDATE users SET approved = 1 WHERE role = $1', ['student']);
      return res.json({ count: result.rowCount || 0 });
    }
    const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
    if (expertMajors.length === 0) return res.json({ count: 0 });
    const allStudents = await queryAll("SELECT id, major FROM users WHERE role = 'student' AND COALESCE(major,'') != ''");
    const ids = allStudents.filter(s => majorMatches(s.major, expertMajors)).map(s => s.id);
    if (ids.length === 0) return res.json({ count: 0 });
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`UPDATE users SET approved = 1 WHERE id IN (${placeholders})`, ids);
    res.json({ count: result.rowCount || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/students/disable-all', async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin';
    if (isAdmin) {
      const result = await query('UPDATE users SET approved = 0 WHERE role = $1', ['student']);
      return res.json({ count: result.rowCount || 0 });
    }
    const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
    if (expertMajors.length === 0) return res.json({ count: 0 });
    const allStudents = await queryAll("SELECT id, major FROM users WHERE role = 'student' AND COALESCE(major,'') != ''");
    const ids = allStudents.filter(s => majorMatches(s.major, expertMajors)).map(s => s.id);
    if (ids.length === 0) return res.json({ count: 0 });
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`UPDATE users SET approved = 0 WHERE id IN (${placeholders})`, ids);
    res.json({ count: result.rowCount || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/students/:studentId/clarify', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const student = await queryOne('SELECT id, email FROM users WHERE id = $1 AND role = $2', [studentId, 'student']);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (req.userRole !== 'admin') {
      const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
      const s = await queryOne('SELECT major FROM users WHERE id = $1', [studentId]);
      if (!majorMatches(s?.major, expertMajors)) return res.status(403).json({ error: 'Student not in your majors' });
    }
    const message = req.body.message != null ? String(req.body.message).trim().slice(0, 500) : '';
    if (!message) return res.status(400).json({ error: 'Message required' });
    const r = await query(
      'INSERT INTO clarifications (student_id, from_user_id, message) VALUES ($1, $2, $3) RETURNING id, message, created_at',
      [studentId, req.userId, message]
    );
    const row = r.rows[0];
    const fromUser = await queryOne('SELECT email FROM users WHERE id = $1', [req.userId]);
    try {
      await sendClarificationEmail(
        student.email,
        'Clarification from admission committee – Wisdom Document System',
        `The admission committee has sent you a note:\n\n${message}\n\n— ${fromUser?.email || 'Committee'}`
      );
    } catch (_) {}
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/students/:studentId/feedback', feedbackUpload.single('file'), async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const student = await queryOne('SELECT id, email FROM users WHERE id = $1 AND role = $2', [studentId, 'student']);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (req.userRole !== 'admin') {
      const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
      const s = await queryOne('SELECT major FROM users WHERE id = $1', [studentId]);
      if (!majorMatches(s?.major, expertMajors)) return res.status(403).json({ error: 'Student not in your majors' });
    }
    const description = req.body.description != null ? String(req.body.description).trim().slice(0, 500) : null;
    let originalName, filePath, fileSize;

    if (req.file) {
      originalName = req.body.originalName || req.file.originalname || 'Feedback';
      filePath = req.file.filename;
      fileSize = req.file.size;
    } else if (description) {
      originalName = 'Committee note.txt';
      const txtFilename = `${uuidv4()}.txt`;
      filePath = txtFilename;
      fs.writeFileSync(path.join(uploadsDir, txtFilename), description, 'utf8');
      fileSize = Buffer.byteLength(description, 'utf8');
    } else {
      return res.status(400).json({ error: 'Provide a message and/or upload a file' });
    }

    const r = await query(
      'INSERT INTO documents (user_id, type, filename, path, size, description, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, type, filename, path, size, created_at, description',
      [studentId, 'feedback', originalName, filePath, fileSize, description || null, req.userId]
    );
    const row = r.rows[0];
    const fromUser = await queryOne('SELECT email FROM users WHERE id = $1', [req.userId]);
    const descText = description ? `\n\nNote: ${description}` : '';
    try {
      await sendClarificationEmail(
        student.email,
        'New feedback from admission committee – Wisdom Document System',
        `The admission committee has uploaded feedback for you: "${originalName}"${descText}\n\nPlease log in to view and download it.\n\n— ${fromUser?.email || 'Committee'}`
      );
    } catch (_) {}
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/students/:id/approve', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const student = await queryOne('SELECT id, major FROM users WHERE id = $1 AND role = $2', [id, 'student']);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (req.userRole !== 'admin') {
      const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
      if (!majorMatches(student.major, expertMajors)) return res.status(403).json({ error: 'Major does not match' });
    }
    const current = await queryOne('SELECT approved FROM users WHERE id = $1', [id]);
    const next = current.approved === 1 ? 0 : 1;
    await query('UPDATE users SET approved = $1 WHERE id = $2', [next, id]);
    res.json({ approved: next === 1 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/students/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const student = await queryOne('SELECT id, email, major, created_at, COALESCE(approved, 0) AS approved FROM users WHERE id = $1 AND role = $2', [studentId, 'student']);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (req.userRole !== 'admin') {
      const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
      if (!majorMatches(student.major, expertMajors)) return res.status(404).json({ error: 'Student not found' });
    }
    let documents;
    try {
      documents = await queryAll(
        'SELECT id, type, filename, path, size, created_at, description, uploaded_by FROM documents WHERE user_id = $1 ORDER BY uploaded_by IS NULL DESC, type, created_at DESC',
        [studentId]
      );
    } catch (_) {
      documents = await queryAll(
        'SELECT id, type, filename, path, size, created_at FROM documents WHERE user_id = $1 ORDER BY type, created_at DESC',
        [studentId]
      );
    }
    const messages = await queryAll('SELECT id, message, created_at FROM messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [studentId]);
    const clarifications = await queryAll(
      'SELECT c.id, c.message, c.created_at, u.email AS from_email FROM clarifications c LEFT JOIN users u ON u.id = c.from_user_id WHERE c.student_id = $1 ORDER BY c.created_at DESC',
      [studentId]
    );
    res.json({
      student: { id: student.id, email: student.email, major: student.major, created_at: student.created_at, approved: student.approved === 1 },
      documents,
      messages: messages || [],
      clarifications,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const u = await queryOne('SELECT id, email, role, majors FROM users WHERE id = $1', [req.userId]);
    if (!u) return res.status(404).json({ error: 'Not found' });
    res.json({ id: u.id, email: u.email, role: u.role, majors: parseMajors(u.majors) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/me', async (req, res) => {
  try {
    if (req.userRole !== 'expert' && req.userRole !== 'admin') return res.status(403).json({ error: 'Experts only' });
    const majors = Array.isArray(req.body.majors) ? req.body.majors : (typeof req.body.majors === 'string' ? req.body.majors.split(',').map(m => m.trim()).filter(Boolean) : []);
    await query('UPDATE users SET majors = $1 WHERE id = $2', [JSON.stringify(majors), req.userId]);
    res.json({ majors });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/students/:studentId/documents/:docId/download', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const docId = parseInt(req.params.docId, 10);
    const student = await queryOne('SELECT id, major FROM users WHERE id = $1 AND role = $2', [studentId, 'student']);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (req.userRole !== 'admin') {
      const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
      if (!majorMatches(student.major, expertMajors)) return res.status(403).json({ error: 'Student not found' });
    }
    const doc = await queryOne('SELECT id, filename, path FROM documents WHERE id = $1 AND user_id = $2', [docId, studentId]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const filePath = path.join(uploadsDir, doc.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath, doc.filename);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
