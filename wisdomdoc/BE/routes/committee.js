import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { db } from '../db.js';
import { authMiddleware, requireCommittee } from '../middleware/auth.js';
import { majorMatches } from '../utils/majorMatch.js';
import { CaseStatus } from '../constants/caseStatus.js';
import { sendClarificationEmail } from '../utils/email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MESSAGE_CAP = 10;
const CLARIFICATION_CAP = 10;
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

router.get('/students', (req, res) => {
  const isAdmin = req.userRole === 'admin';
  let students;
  const approvedCaseSubquery = `(SELECT COUNT(*) FROM cases c2 WHERE c2.student_id = u.id AND c2.status = '${CaseStatus.APPROVED}') AS has_approved_case`;
  const targetYearFromLatestCase = `(SELECT CASE WHEN ca.case_id LIKE 'WL-____-%' AND length(ca.case_id) >= 11
    THEN CAST(substr(ca.case_id, 4, 4) AS INTEGER) END
    FROM cases ca WHERE ca.student_id = u.id ORDER BY ca.created_at DESC LIMIT 1)`;
  const targetYearExpr = `COALESCE(u.target_year, ${targetYearFromLatestCase}) AS target_year`;
  if (isAdmin) {
    students = db.prepare(`
      SELECT u.id, u.email, u.username, u.major, u.created_at, COALESCE(u.approved, 0) AS approved,
             (SELECT COUNT(*) FROM documents d WHERE d.user_id = u.id) AS doc_count,
             (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) AS message_count,
             ${approvedCaseSubquery},
             ${targetYearExpr}
      FROM users u
      WHERE u.role = 'student'
      ORDER BY u.created_at DESC
    `).all();
  } else {
    const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
    if (expertMajors.length === 0) {
      students = [];
    } else {
      const allStudents = db.prepare(`
        SELECT u.id, u.email, u.username, u.major, u.created_at, COALESCE(u.approved, 0) AS approved,
               (SELECT COUNT(*) FROM documents d WHERE d.user_id = u.id) AS doc_count,
               (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) AS message_count,
               ${approvedCaseSubquery},
               ${targetYearExpr}
        FROM users u
        WHERE u.role = 'student' AND COALESCE(u.major,'') != ''
        ORDER BY u.created_at DESC
      `).all();
      students = allStudents.filter(s => majorMatches(s.major, expertMajors));
    }
  }
  res.json({ students });
});

router.patch('/students/approve-all', (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const result = db.prepare('UPDATE users SET approved = 1 WHERE role = ?').run('student');
  return res.json({ count: result.changes });
});

router.patch('/students/disable-all', (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const result = db.prepare('UPDATE users SET approved = 0 WHERE role = ?').run('student');
  return res.json({ count: result.changes });
});

router.post('/students/:studentId/clarify', async (req, res) => {
  const studentId = parseInt(req.params.studentId, 10);
  const student = db.prepare('SELECT id, email FROM users WHERE id = ? AND role = ?').get(studentId, 'student');
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.userRole !== 'admin') {
    const assigned = db.prepare('SELECT id FROM cases WHERE student_id = ? AND assigned_expert_id = ?').get(studentId, req.userId);
    const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
    const s = db.prepare('SELECT major FROM users WHERE id = ?').get(studentId);
    if (!assigned && !majorMatches(s?.major, expertMajors)) return res.status(403).json({ error: 'Student not in your majors' });
  }
  const message = req.body.message != null ? String(req.body.message).trim().slice(0, 500) : '';
  if (!message) return res.status(400).json({ error: 'Message required' });
  db.prepare('INSERT INTO clarifications (student_id, from_user_id, message) VALUES (?, ?, ?)').run(studentId, req.userId, message);
  const count = db.prepare('SELECT COUNT(*) as c FROM clarifications WHERE student_id = ?').get(studentId).c;
  if (count > CLARIFICATION_CAP) {
    const toDelete = count - CLARIFICATION_CAP;
    db.prepare(
      'DELETE FROM clarifications WHERE id IN (SELECT id FROM clarifications WHERE student_id = ? ORDER BY created_at ASC LIMIT ?)'
    ).run(studentId, toDelete);
  }
  const row = db.prepare('SELECT id, message, created_at FROM clarifications WHERE id = last_insert_rowid()').get();
  const fromUser = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId);
  try {
    await sendClarificationEmail(
      student.email,
      'Clarification from admission committee – Wisdom Document System',
      `The admission committee has sent you a note:\n\n${message}\n\n— ${fromUser?.email || 'Committee'}`
    );
  } catch (_) {}
  res.status(201).json(row);
});

router.post('/students/:studentId/feedback', feedbackUpload.single('file'), async (req, res) => {
  const studentId = parseInt(req.params.studentId, 10);
  const student = db.prepare('SELECT id, email FROM users WHERE id = ? AND role = ?').get(studentId, 'student');
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.userRole !== 'admin') {
    const assigned = db.prepare('SELECT id FROM cases WHERE student_id = ? AND assigned_expert_id = ?').get(studentId, req.userId);
    const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
    const s = db.prepare('SELECT major FROM users WHERE id = ?').get(studentId);
    if (!assigned && !majorMatches(s?.major, expertMajors)) return res.status(403).json({ error: 'Student not in your majors' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const description = req.body.description != null ? String(req.body.description).trim().slice(0, 200) : null;
  const originalName = req.body.originalName || req.file.originalname || 'Feedback';
  db.prepare(
    'INSERT INTO documents (user_id, type, filename, path, size, description, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(studentId, 'feedback', originalName, req.file.filename, req.file.size, description || null, req.userId);
  const row = db.prepare('SELECT id, type, filename, path, size, created_at, description FROM documents WHERE id = last_insert_rowid()').get();
  const fromUser = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId);
  const descText = description ? `\n\nNote: ${description}` : '';
  try {
    await sendClarificationEmail(
      student.email,
      'New feedback from admission committee – Wisdom Document System',
      `The admission committee has uploaded feedback for you: "${originalName}"${descText}\n\nPlease log in to view and download it.\n\n— ${fromUser?.email || 'Committee'}`
    );
  } catch (_) {}
  res.status(201).json(row);
});

router.patch('/students/:id/approve', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const student = db.prepare('SELECT id, major FROM users WHERE id = ? AND role = ?').get(id, 'student');
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.userRole !== 'admin') {
    const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
    const assigned = db.prepare('SELECT id FROM cases WHERE student_id = ? AND assigned_expert_id = ?').get(id, req.userId);
    if (!assigned && !majorMatches(student.major, expertMajors)) {
      return res.status(403).json({ error: 'Not allowed for this student' });
    }
    const approvedCase = db.prepare('SELECT id FROM cases WHERE student_id = ? AND status = ? LIMIT 1').get(id, CaseStatus.APPROVED);
    if (approvedCase) {
      return res.status(403).json({
        error: 'Cannot change upload access while the case is final-approved. An admin must reopen the case first.',
      });
    }
  }
  const current = db.prepare('SELECT approved FROM users WHERE id = ?').get(id);
  const next = current.approved === 1 ? 0 : 1;
  db.prepare('UPDATE users SET approved = ? WHERE id = ?').run(next, id);
  res.json({ approved: next === 1 });
});

router.get('/students/:id', (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  const student = db.prepare(`
    SELECT u.id, u.email, u.major, u.created_at, COALESCE(u.approved, 0) AS approved, u.timezone, u.username, u.bio, u.title, u.image, u.phone, u.country, u.state, u.city,
           COALESCE(u.target_year, (SELECT CASE WHEN ca.case_id LIKE 'WL-____-%' AND length(ca.case_id) >= 11
             THEN CAST(substr(ca.case_id, 4, 4) AS INTEGER) END
             FROM cases ca WHERE ca.student_id = u.id ORDER BY ca.created_at DESC LIMIT 1)) AS target_year
    FROM users u WHERE u.id = ? AND u.role = ?
  `).get(studentId, 'student');
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.userRole !== 'admin') {
    const assigned = db.prepare('SELECT id FROM cases WHERE student_id = ? AND assigned_expert_id = ?').get(studentId, req.userId);
    const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
    if (!assigned && !majorMatches(student.major, expertMajors)) return res.status(404).json({ error: 'Student not found' });
  }
  let documents;
  try {
    documents = db.prepare(
      'SELECT id, type, filename, path, size, created_at, description, uploaded_by, COALESCE(version, 1) as version FROM documents WHERE user_id = ? ORDER BY uploaded_by IS NULL DESC, type, COALESCE(version, 1) DESC, created_at DESC'
    ).all(studentId);
  } catch (err) {
    documents = db.prepare(
      'SELECT id, type, filename, path, size, created_at FROM documents WHERE user_id = ? ORDER BY type, created_at DESC'
    ).all(studentId);
  }
  const messages = db.prepare(`SELECT id, message, created_at FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ${MESSAGE_CAP}`).all(studentId);
  const clarifications = db.prepare(
    'SELECT c.id, c.message, c.created_at, u.email AS from_email FROM clarifications c LEFT JOIN users u ON u.id = c.from_user_id WHERE c.student_id = ? ORDER BY c.created_at DESC'
  ).all(studentId);
  const caseCountRow = db.prepare('SELECT COUNT(*) AS c FROM cases WHERE student_id = ?').get(studentId);
  const hasSubmittedApplication = (caseCountRow?.c || 0) > 0;
  const approvedCase = db.prepare('SELECT id FROM cases WHERE student_id = ? AND status = ? LIMIT 1').get(studentId, CaseStatus.APPROVED);
  res.json({
    student: {
      id: student.id, email: student.email, major: student.major, created_at: student.created_at, approved: student.approved === 1,
      hasApprovedCase: !!approvedCase,
      timezone: student.timezone || 'America/Chicago', username: student.username, bio: student.bio, title: student.title, image: student.image, phone: student.phone, country: student.country, state: student.state, city: student.city,
      target_year: student.target_year != null ? Number(student.target_year) : null,
    },
    documents,
    messages: messages || [],
    clarifications,
    hasSubmittedApplication,
  });
});

router.get('/me', (req, res) => {
  const u = db.prepare('SELECT id, email, role, majors, username, bio, title, image, phone FROM users WHERE id = ?').get(req.userId);
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({ id: u.id, email: u.email, role: u.role, majors: parseMajors(u.majors), username: u.username, bio: u.bio, title: u.title, image: u.image, phone: u.phone });
});
router.patch('/me', (req, res) => {
  if (req.userRole !== 'expert' && req.userRole !== 'admin') return res.status(403).json({ error: 'Experts only' });
  const { majors: m, username, bio, title } = req.body;
  const majors = Array.isArray(m) ? m : (typeof m === 'string' ? m.split(',').map(x => x.trim()).filter(Boolean) : null);
  if (majors != null) db.prepare('UPDATE users SET majors = ? WHERE id = ?').run(JSON.stringify(majors), req.userId);
  if (username != null) db.prepare('UPDATE users SET username = ? WHERE id = ?').run(String(username).trim().slice(0, 100), req.userId);
  if (bio != null) db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(String(bio).trim().slice(0, 2000), req.userId);
  if (title != null) db.prepare('UPDATE users SET title = ? WHERE id = ?').run(String(title).trim().slice(0, 200), req.userId);
  const u = db.prepare('SELECT id, email, role, majors, username, bio, title, image, phone FROM users WHERE id = ?').get(req.userId);
  res.json({ id: u.id, email: u.email, role: u.role, majors: parseMajors(u.majors), username: u.username, bio: u.bio, title: u.title, image: u.image, phone: u.phone });
});

function getDocForStudent(req, studentId, docId) {
  const student = db.prepare('SELECT id, major FROM users WHERE id = ? AND role = ?').get(studentId, 'student');
  if (!student) return null;
  if (req.userRole !== 'admin') {
    const assigned = db.prepare('SELECT id FROM cases WHERE student_id = ? AND assigned_expert_id = ?').get(studentId, req.userId);
    const expertMajors = (req.userMajors || []).map(m => m.trim().toLowerCase()).filter(Boolean);
    if (!assigned && !majorMatches(student.major, expertMajors)) return null;
  }
  const doc = db.prepare('SELECT id, filename, path FROM documents WHERE id = ? AND user_id = ?').get(docId, studentId);
  if (!doc) return null;
  const filePath = path.join(uploadsDir, doc.path);
  if (!fs.existsSync(filePath)) return null;
  return { doc, filePath };
}

router.get('/students/:studentId/documents/:docId/download', (req, res) => {
  const studentId = parseInt(req.params.studentId, 10);
  const docId = parseInt(req.params.docId, 10);
  const result = getDocForStudent(req, studentId, docId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  res.download(result.filePath, result.doc.filename);
});

router.get('/students/:studentId/documents/:docId/preview', (req, res) => {
  const studentId = parseInt(req.params.studentId, 10);
  const docId = parseInt(req.params.docId, 10);
  const result = getDocForStudent(req, studentId, docId);
  if (!result) return res.status(404).json({ error: 'Not found' });
  const ext = (path.extname(result.doc.filename) || '').toLowerCase();
  const contentTypes = { '.pdf': 'application/pdf', '.txt': 'text/plain', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  const contentType = contentTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(result.doc.filename)}"`);
  res.sendFile(result.filePath);
});

export default router;
