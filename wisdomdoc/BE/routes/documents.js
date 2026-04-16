import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { db } from '../db.js';
import { authMiddleware, requireStudent } from '../middleware/auth.js';
import { CaseStatus } from '../constants/caseStatus.js';

function hasApprovedCase(studentId) {
  const row = db.prepare('SELECT id FROM cases WHERE student_id = ? AND status = ?').get(studentId, CaseStatus.APPROVED);
  return !!row;
}

/** In-progress case (not finally closed: approved, rejected, or withdrawn) */
function getActiveNonTerminalCase(studentId) {
  return db.prepare(
    'SELECT id, status FROM cases WHERE student_id = ? AND status NOT IN (?, ?, ?)'
  ).get(studentId, CaseStatus.APPROVED, CaseStatus.REJECTED, CaseStatus.WITHDRAWN);
}

function hasRejectedOrWithdrawnCase(studentId) {
  const row = db.prepare(
    'SELECT id FROM cases WHERE student_id = ? AND status IN (?, ?) LIMIT 1'
  ).get(studentId, CaseStatus.REJECTED, CaseStatus.WITHDRAWN);
  return !!row;
}

/**
 * Upload/remove allowed when committee enabled upload, no final approval, and:
 * - no in-progress case and no rejected/withdrawn-only history (still preparing first submission), or
 * - needs_info (committee asked for more).
 * After submit (submitted+), uploads stay locked until needs_info.
 * Rejected or withdrawn cases with no newer in-progress case block uploads (no orphaned uploads).
 */
function canStudentUploadDocuments(studentId) {
  const user = db.prepare('SELECT approved FROM users WHERE id = ?').get(studentId);
  if (!user || user.approved !== 1) return false;
  if (hasApprovedCase(studentId)) return false;
  const active = getActiveNonTerminalCase(studentId);
  if (active) {
    if (active.status === CaseStatus.NEEDS_INFO) return true;
    return false;
  }
  if (hasRejectedOrWithdrawnCase(studentId)) return false;
  return true;
}

function uploadDisabledReasonFor(studentId, isApproved) {
  if (canStudentUploadDocuments(studentId)) return null;
  if (!isApproved) return 'committee_disabled';
  if (hasApprovedCase(studentId)) return 'final_approved';
  const active = getActiveNonTerminalCase(studentId);
  if (active) {
    if (active.status === CaseStatus.SUBMITTED) return 'submitted_pending_assignment';
    return 'case_in_review';
  }
  const r = db.prepare(
    'SELECT status FROM cases WHERE student_id = ? AND status IN (?, ?) ORDER BY created_at DESC LIMIT 1'
  ).get(studentId, CaseStatus.REJECTED, CaseStatus.WITHDRAWN);
  if (r?.status === CaseStatus.REJECTED) return 'application_rejected';
  if (r?.status === CaseStatus.WITHDRAWN) return 'withdrawn';
  return 'case_in_review';
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');

const ALLOWED_TYPES = ['sop', 'lor', 'resume', 'transcript', 'additional'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MESSAGE_CAP = 10;

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

router.get('/', (req, res) => {
  const user = db.prepare('SELECT approved, timezone FROM users WHERE id = ?').get(req.userId) || {};
  const isApproved = user && user.approved === 1;
  let docs;
  try {
    docs = db.prepare(
      'SELECT id, type, filename, path, size, created_at, description, uploaded_by, COALESCE(version, 1) as version FROM documents WHERE user_id = ? ORDER BY type, COALESCE(version, 1) DESC, created_at DESC'
    ).all(req.userId);
  } catch (_) {
    docs = db.prepare(
      'SELECT id, type, filename, path, size, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.userId);
  }
  const messages = db.prepare(`SELECT id, message, created_at FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ${MESSAGE_CAP}`).all(req.userId);
  let clarifications = [];
  try {
    clarifications = db.prepare(`
      SELECT c.id, c.message, c.created_at, u.email AS from_email
      FROM clarifications c
      JOIN users u ON u.id = c.from_user_id
      WHERE c.student_id = ?
      ORDER BY c.created_at DESC
    `).all(req.userId);
  } catch (_) {}
  const canUpload = canStudentUploadDocuments(req.userId);
  res.json({
    documents: docs,
    messages: messages || [],
    clarifications,
    isApproved: !!isApproved,
    timezone: user.timezone || 'America/Chicago',
    canUploadDocuments: canUpload,
    uploadDisabledReason: uploadDisabledReasonFor(req.userId, !!isApproved),
    /** Uploads may be closed after submit; messaging stays available for all students */
    canMessageCommittee: true,
  });
});

router.post('/upload', upload.single('file'), (req, res) => {
  if (!canStudentUploadDocuments(req.userId)) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    const user = db.prepare('SELECT approved FROM users WHERE id = ?').get(req.userId);
    if (!user || user.approved !== 1) {
      return res.status(403).json({ error: 'Only selected students can upload. Contact the committee.' });
    }
    if (hasApprovedCase(req.userId)) {
      return res.status(403).json({ error: 'Uploads are closed after your application has been approved.' });
    }
    const active = getActiveNonTerminalCase(req.userId);
    if (active?.status === CaseStatus.SUBMITTED) {
      return res.status(403).json({
        error:
          'Uploads are closed after you submit your application. You can upload again only if the committee asks for more information.',
      });
    }
    if (!active && hasRejectedOrWithdrawnCase(req.userId)) {
      const r = db.prepare(
        'SELECT status FROM cases WHERE student_id = ? AND status IN (?, ?) ORDER BY created_at DESC LIMIT 1'
      ).get(req.userId, CaseStatus.REJECTED, CaseStatus.WITHDRAWN);
      if (r?.status === CaseStatus.WITHDRAWN) {
        return res.status(403).json({ error: 'Uploads are closed for withdrawn applications.' });
      }
      return res.status(403).json({ error: 'Uploads are closed after a decision on your application.' });
    }
    return res.status(403).json({
      error:
        'Uploads are closed while your case is under review. You can upload again when the committee asks for more information.',
    });
  }
  const type = (req.body.type || '').toLowerCase();
  const caseId = req.body.caseId ? parseInt(req.body.caseId, 10) : null;
  if (!ALLOWED_TYPES.includes(type)) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid type.' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const originalName = req.body.originalName || req.file.originalname || type;
  const description = type === 'additional' && req.body.description != null ? String(req.body.description).trim().slice(0, 200) : null;

  const maxRow = db.prepare(
    'SELECT COALESCE(MAX(version), 0) as v FROM documents WHERE user_id = ? AND type = ?'
  ).get(req.userId, type);
  const version = (maxRow?.v || 0) + 1;

  db.prepare(
    'INSERT INTO documents (user_id, case_id, type, filename, path, size, description, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.userId, caseId || null, type, originalName, req.file.filename, req.file.size, description || null, version);
  const row = db.prepare('SELECT id, type, filename, path, size, created_at, description, version FROM documents WHERE id = last_insert_rowid()').get();
  res.status(201).json(row);
});

router.post('/message', (req, res) => {
  const message = req.body.message != null ? String(req.body.message).trim() : '';
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  db.prepare('INSERT INTO messages (user_id, message) VALUES (?, ?)').run(req.userId, message);
  const count = db.prepare('SELECT COUNT(*) as c FROM messages WHERE user_id = ?').get(req.userId).c;
  if (count > MESSAGE_CAP) {
    const toDelete = count - MESSAGE_CAP;
    db.prepare(
      'DELETE FROM messages WHERE id IN (SELECT id FROM messages WHERE user_id = ? ORDER BY created_at ASC LIMIT ?)'
    ).run(req.userId, toDelete);
  }
  const row = db.prepare('SELECT id, message, created_at FROM messages WHERE id = last_insert_rowid()').get();
  res.status(201).json(row);
});

router.get('/:id/download', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const doc = db.prepare('SELECT id, filename, path FROM documents WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(uploadsDir, doc.path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath, doc.filename);
});

router.get('/:id/preview', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const doc = db.prepare('SELECT id, filename, path FROM documents WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(uploadsDir, doc.path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  const ext = (path.extname(doc.filename) || '').toLowerCase();
  const contentTypes = { '.pdf': 'application/pdf', '.txt': 'text/plain', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  const contentType = contentTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.filename)}"`);
  res.sendFile(filePath);
});

router.delete('/:id', (req, res) => {
  if (!canStudentUploadDocuments(req.userId)) {
    if (hasApprovedCase(req.userId)) {
      return res.status(403).json({ error: 'Documents cannot be removed after your application has been approved.' });
    }
    const user = db.prepare('SELECT approved FROM users WHERE id = ?').get(req.userId);
    if (!user || user.approved !== 1) {
      return res.status(403).json({ error: 'Documents cannot be removed. Contact the committee.' });
    }
    const active = getActiveNonTerminalCase(req.userId);
    if (active?.status === CaseStatus.SUBMITTED) {
      return res.status(403).json({
        error:
          'Documents cannot be changed after you submit your application until the committee asks for more information.',
      });
    }
    if (!active && hasRejectedOrWithdrawnCase(req.userId)) {
      return res.status(403).json({ error: 'Documents cannot be changed after a final decision or withdrawal.' });
    }
    return res.status(403).json({
      error:
        'Documents cannot be removed while your case is under review. You can change files again when the committee asks for more information.',
    });
  }
  const id = parseInt(req.params.id, 10);
  const row = db.prepare('SELECT id, path FROM documents WHERE id = ? AND user_id = ? AND uploaded_by IS NULL').get(id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(uploadsDir, row.path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  res.json({ deleted: id });
});

export default router;
