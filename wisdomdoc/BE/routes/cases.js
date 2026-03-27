import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { majorMatches } from '../utils/majorMatch.js';
import { CaseStatus, CASE_STATUSES, STATUS_TRANSITIONS, EMAIL_TRIGGER_STATUSES } from '../constants/caseStatus.js';
import { sendStatusEmail } from '../utils/emailTriggers.js';

const MESSAGE_CAP_PER_CASE = 10;
const ADDITIONAL_FIELDS_LIMIT = 10;

function parseMajors(s) {
  if (!s) return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a : [];
  } catch {
    return (s || '').split(',').map((m) => m.trim()).filter(Boolean);
  }
}

function generateCaseId() {
  const year = new Date().getFullYear();
  const last = db.prepare(
    "SELECT case_id FROM cases WHERE case_id LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`WL-${year}-%`);
  let seq = 1;
  if (last) {
    const match = last.case_id.match(/WL-\d{4}-(\d+)/);
    const parsed = match ? parseInt(match[1], 10) : 0;
    if (!Number.isNaN(parsed)) seq = parsed + 1;
  }
  return `WL-${year}-${String(seq).padStart(5, '0')}`;
}

function canTransition(fromStatus, toStatus) {
  const allowed = STATUS_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus) || fromStatus === toStatus;
}

function logCaseUpdate(caseId, fromStatus, toStatus, userId, note = null) {
  try {
    db.prepare(
      'INSERT INTO case_updates (case_id, from_status, to_status, changed_by, note) VALUES (?, ?, ?, ?, ?)'
    ).run(caseId, fromStatus, toStatus, userId, note);
  } catch (_) {}
}

function logEvent(entityType, entityId, eventType, actorId, payload) {
  try {
    db.prepare(
      'INSERT INTO event_log (entity_type, entity_id, event_type, actor_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(entityType, entityId, eventType, actorId || null, JSON.stringify(payload || {}), new Date().toISOString());
  } catch (_) {}
}

async function triggerEmailIfNeeded(status, caseRow) {
  if (!EMAIL_TRIGGER_STATUSES.includes(status)) return;
  try {
    const student = db.prepare('SELECT email FROM users WHERE id = ?').get(caseRow.student_id);
    let expert = null;
    if (caseRow.assigned_expert_id) {
      expert = db.prepare('SELECT email, username FROM users WHERE id = ?').get(caseRow.assigned_expert_id);
    }
    await sendStatusEmail(status, {
      studentEmail: student?.email,
      expertEmail: expert?.email,
      caseId: caseRow.case_id,
      expertName: expert?.username,
    });
  } catch (e) {
    console.error('Email trigger error:', e.message);
  }
}

const router = Router();

router.use(authMiddleware);

/** Student submits application */
router.post('/', (req, res) => {
  if (req.userRole !== 'student') return res.status(403).json({ error: 'Students only' });
  const student = db.prepare('SELECT id, approved, major FROM users WHERE id = ? AND role = ?').get(req.userId, 'student');
  if (!student) return res.status(403).json({ error: 'Not a student' });
  if (!student.approved) return res.status(403).json({ error: 'Upload not enabled.' });

  const existing = db.prepare(
    'SELECT id FROM cases WHERE student_id = ? AND status NOT IN (?, ?)'
  ).get(req.userId, CaseStatus.APPROVED, CaseStatus.REJECTED);
  if (existing) return res.status(400).json({ error: 'You already have an active application.' });

  const requiredTypes = ['sop', 'lor', 'resume'];
  const docs = db.prepare('SELECT type FROM documents WHERE user_id = ? AND (uploaded_by IS NULL OR uploaded_by = 0)').all(req.userId);
  const hasTypes = requiredTypes.every((t) => docs.some((d) => d.type === t));
  if (!hasTypes) return res.status(400).json({ error: 'Please upload SOP, LOR, and Resume before submitting.' });

  const submittedAt = new Date().toISOString();
  const dueAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  let row;
  for (let attempt = 0; attempt < 5; attempt++) {
    const caseId = generateCaseId();
    try {
      db.prepare(
        'INSERT INTO cases (student_id, case_id, status, submitted_at, due_at) VALUES (?, ?, ?, ?, ?)'
      ).run(req.userId, caseId, CaseStatus.SUBMITTED, submittedAt, dueAt);
      row = db.prepare('SELECT id, case_id, status, created_at, submitted_at, due_at FROM cases WHERE id = last_insert_rowid()').get();
      break;
    } catch (err) {
      const isUniqueViolation = err?.code === 'SQLITE_CONSTRAINT' || err?.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err?.message && String(err.message).includes('UNIQUE'));
      if (isUniqueViolation && attempt < 4) continue;
      throw err;
    }
  }
  db.prepare('UPDATE users SET submitted_at = ? WHERE id = ?').run(submittedAt, req.userId);
  logEvent('case', row.id, 'created', req.userId, { status: CaseStatus.SUBMITTED });
  res.status(201).json(row);
});

/** Get cases: student=own, expert=assigned, admin=all */
router.get('/', (req, res) => {
  if (req.userRole === 'student') {
    const cases = db.prepare(`
      SELECT c.id, c.case_id, c.status, c.created_at, c.submitted_at, c.due_at,
             c.assessed_at, c.approved_at, c.rejected_at, u.email, u.major
      FROM cases c
      JOIN users u ON u.id = c.student_id
      WHERE c.student_id = ?
      ORDER BY c.created_at DESC
    `).all(req.userId);
    return res.json({ cases });
  }
  if (req.userRole === 'admin') {
    const cases = db.prepare(`
      SELECT c.id, c.case_id, c.status, c.created_at, c.submitted_at, c.due_at,
             c.assessed_at, c.approved_at, c.rejected_at, c.assigned_expert_id,
             u.id AS student_id, u.email, u.major,
             e.email AS expert_email, e.username AS expert_username
      FROM cases c
      JOIN users u ON u.id = c.student_id
      LEFT JOIN users e ON e.id = c.assigned_expert_id
      ORDER BY c.created_at DESC
    `).all();
    return res.json({ cases });
  }
  if (req.userRole === 'expert') {
    const cases = db.prepare(`
      SELECT c.id, c.case_id, c.status, c.created_at, c.submitted_at, c.due_at,
             c.assessed_at, c.approved_at, c.rejected_at,
             u.id AS student_id, u.email, u.major
      FROM cases c
      JOIN users u ON u.id = c.student_id
      WHERE c.assigned_expert_id = ?
      ORDER BY c.created_at DESC
    `).all(req.userId);
    return res.json({ cases });
  }
  return res.status(403).json({ error: 'Forbidden' });
});

/** List experts for assignment (?caseId=X for recommended first) */
router.get('/experts', (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const caseId = req.query.caseId ? parseInt(req.query.caseId, 10) : null;
  let studentMajor = null;
  if (caseId) {
    const c = db.prepare('SELECT student_id FROM cases WHERE id = ?').get(caseId);
    if (c) studentMajor = db.prepare('SELECT major FROM users WHERE id = ?').get(c.student_id)?.major;
  }
  const experts = db.prepare(`
    SELECT id, email, username, title, bio, majors
    FROM users WHERE role = 'expert'
    ORDER BY username, email
  `).all();
  const withMajors = experts.map((e) => ({
    ...e,
    majors: parseMajors(e.majors),
    recommended: studentMajor ? majorMatches(studentMajor, parseMajors(e.majors)) : false,
  }));
  if (studentMajor) withMajors.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
  res.json({ experts: withMajors });
});

/** Admin: assign expert */
router.patch('/:id/assign', async (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const id = parseInt(req.params.id, 10);
  const expertId = req.body.expertId != null ? parseInt(req.body.expertId, 10) : null;
  const caseRow = db.prepare('SELECT id, case_id, student_id, status, assigned_expert_id FROM cases WHERE id = ?').get(id);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });
  if ([CaseStatus.APPROVED, CaseStatus.REJECTED].includes(caseRow.status)) {
    return res.status(400).json({ error: 'Case already completed' });
  }

  if (expertId) {
    const expert = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(expertId, 'expert');
    if (!expert) return res.status(400).json({ error: 'Invalid expert' });
  }

  const oldStatus = caseRow.status;
  const newStatus = expertId ? CaseStatus.ASSIGNED : (caseRow.status === CaseStatus.OVERDUE ? CaseStatus.OVERDUE : CaseStatus.SUBMITTED);
  db.prepare('UPDATE cases SET assigned_expert_id = ?, status = ? WHERE id = ?').run(expertId || null, newStatus, id);
  logCaseUpdate(id, oldStatus, newStatus, req.userId, expertId ? 'Expert assigned' : 'Expert unassigned');
  logEvent('case', id, 'expert_assigned', req.userId, { expertId });

  const updated = db.prepare(`
    SELECT c.id, c.case_id, c.status, c.assigned_expert_id, c.due_at,
           e.email AS expert_email, e.username AS expert_username
    FROM cases c
    LEFT JOIN users e ON e.id = c.assigned_expert_id
    WHERE c.id = ?
  `).get(id);

  if (expertId) {
    const caseWithStudent = db.prepare('SELECT student_id FROM cases WHERE id = ?').get(id);
    await triggerEmailIfNeeded(CaseStatus.ASSIGNED, { ...caseWithStudent, case_id: caseRow.case_id, assigned_expert_id: expertId });
  }
  res.json(updated);
});

/** Student: resubmit after needs_info */
router.patch('/:id/resubmit', async (req, res) => {
  if (req.userRole !== 'student') return res.status(403).json({ error: 'Students only' });
  const student = db.prepare('SELECT id, approved FROM users WHERE id = ? AND role = ?').get(req.userId, 'student');
  if (!student) return res.status(403).json({ error: 'Not a student' });
  if (!student.approved) return res.status(403).json({ error: 'Upload not enabled. Contact the committee.' });
  const id = parseInt(req.params.id, 10);
  const caseRow = db.prepare('SELECT id, case_id, student_id, status, assigned_expert_id FROM cases WHERE id = ?').get(id);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });
  if (caseRow.student_id !== req.userId) return res.status(403).json({ error: 'Not your case' });
  if (caseRow.status !== CaseStatus.NEEDS_INFO) return res.status(400).json({ error: 'Only cases in Needs Info can be resubmitted' });

  const requiredTypes = ['sop', 'lor', 'resume'];
  const docs = db.prepare('SELECT type FROM documents WHERE user_id = ? AND (uploaded_by IS NULL OR uploaded_by = 0)').all(req.userId);
  const hasTypes = requiredTypes.every((t) => docs.some((d) => d.type === t));
  if (!hasTypes) return res.status(400).json({ error: 'Please upload SOP, LOR, and Resume before resubmitting.' });

  const oldStatus = caseRow.status;
  db.prepare('UPDATE cases SET status = ? WHERE id = ?').run(CaseStatus.RESUBMITTED, id);
  logCaseUpdate(id, oldStatus, CaseStatus.RESUBMITTED, req.userId);
  logEvent('case', id, 'resubmitted', req.userId, {});

  const updated = db.prepare('SELECT id, case_id, status, created_at, submitted_at, due_at FROM cases WHERE id = ?').get(id);
  const fullCase = { ...caseRow, status: CaseStatus.RESUBMITTED };
  await triggerEmailIfNeeded(CaseStatus.RESUBMITTED, fullCase);
  res.json(updated);
});

/** Admin/Expert: update status with validation */
router.patch('/:id/status', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  if (!status || !CASE_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const caseRow = db.prepare('SELECT id, case_id, student_id, assigned_expert_id, status FROM cases WHERE id = ?').get(id);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });

  const isAdmin = req.userRole === 'admin';
  const isExpert = caseRow.assigned_expert_id === req.userId;
  if (!isAdmin && !isExpert) return res.status(403).json({ error: 'Forbidden' });
  if (isExpert && !isAdmin && caseRow.status === CaseStatus.PENDING_ADMIN_APPROVAL) {
    return res.status(403).json({ error: 'Case is awaiting admin decision' });
  }
  if (isExpert && !isAdmin && ![CaseStatus.UNDER_REVIEW, CaseStatus.NEEDS_INFO, CaseStatus.REJECTED].includes(status)) {
    return res.status(403).json({ error: 'Experts can only set under_review, needs_info, or rejected' });
  }

  if (status === CaseStatus.APPROVED) {
    if (!isAdmin) return res.status(403).json({ error: 'Only admin can give final approval' });
    if (caseRow.status !== CaseStatus.PENDING_ADMIN_APPROVAL) {
      return res.status(400).json({ error: 'Final approval is only allowed after expert recommendation (case must be Pending admin approval).' });
    }
  }

  if (!canTransition(caseRow.status, status)) {
    return res.status(400).json({ error: `Invalid transition: ${caseRow.status} -> ${status}` });
  }

  const now = new Date().toISOString();
  const updates = ['status = ?'];
  const params = [status];
  if (status === CaseStatus.APPROVED) {
    updates.push('approved_at = ?');
    params.push(now);
  } else if (status === CaseStatus.REJECTED) {
    updates.push('rejected_at = ?');
    params.push(now);
  } else if ([CaseStatus.UNDER_REVIEW, CaseStatus.ASSIGNED].includes(status)) {
    updates.push('assessed_at = NULL');
  }
  if (status === CaseStatus.SUBMITTED) updates.push('assigned_expert_id = NULL');
  params.push(id);
  db.prepare(`UPDATE cases SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  logCaseUpdate(id, caseRow.status, status, req.userId, 'Status update');
  logEvent('case', id, 'status_change', req.userId, { from: caseRow.status, to: status });

  const fullCase = { ...caseRow, status };
  await triggerEmailIfNeeded(status, fullCase);

  const updated = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
  res.json(updated);
});

/** Expert: recommend approval (admin must finalize) */
router.patch('/:id/approve', async (req, res) => {
  if (req.userRole !== 'expert') return res.status(403).json({ error: 'Experts only' });
  const id = parseInt(req.params.id, 10);
  const caseRow = db.prepare('SELECT id, case_id, student_id, assigned_expert_id, status FROM cases WHERE id = ?').get(id);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });
  if (caseRow.assigned_expert_id !== req.userId) return res.status(403).json({ error: 'Not assigned to you' });
  if ([CaseStatus.APPROVED, CaseStatus.REJECTED, CaseStatus.PENDING_ADMIN_APPROVAL].includes(caseRow.status)) {
    return res.status(400).json({ error: caseRow.status === CaseStatus.PENDING_ADMIN_APPROVAL ? 'Already recommended for approval' : 'Already processed' });
  }
  if (!canTransition(caseRow.status, CaseStatus.PENDING_ADMIN_APPROVAL)) {
    return res.status(400).json({ error: `Cannot recommend approval from status: ${caseRow.status}` });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE cases SET status = ?, assessed_at = ?, approved_at = NULL WHERE id = ?').run(CaseStatus.PENDING_ADMIN_APPROVAL, now, id);
  logCaseUpdate(id, caseRow.status, CaseStatus.PENDING_ADMIN_APPROVAL, req.userId, 'Expert recommended approval');
  logEvent('case', id, 'expert_recommended', req.userId, {});

  const fullCase = { ...caseRow, status: CaseStatus.PENDING_ADMIN_APPROVAL };
  await triggerEmailIfNeeded(CaseStatus.PENDING_ADMIN_APPROVAL, fullCase);

  res.json(db.prepare('SELECT id, case_id, status, assessed_at, approved_at FROM cases WHERE id = ?').get(id));
});

/** Expert: reject */
router.patch('/:id/reject', async (req, res) => {
  if (req.userRole !== 'expert') return res.status(403).json({ error: 'Experts only' });
  const id = parseInt(req.params.id, 10);
  const caseRow = db.prepare('SELECT id, case_id, student_id, assigned_expert_id, status FROM cases WHERE id = ?').get(id);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });
  if (caseRow.assigned_expert_id !== req.userId) return res.status(403).json({ error: 'Not assigned to you' });
  if ([CaseStatus.APPROVED, CaseStatus.REJECTED].includes(caseRow.status)) return res.status(400).json({ error: 'Already processed' });
  if (caseRow.status === CaseStatus.PENDING_ADMIN_APPROVAL) {
    return res.status(400).json({ error: 'Case is awaiting admin decision' });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE cases SET status = ?, rejected_at = ?, assessed_at = ? WHERE id = ?').run(CaseStatus.REJECTED, now, now, id);
  logCaseUpdate(id, caseRow.status, CaseStatus.REJECTED, req.userId);
  logEvent('case', id, 'rejected', req.userId, {});

  await triggerEmailIfNeeded(CaseStatus.REJECTED, caseRow);

  res.json(db.prepare('SELECT id, case_id, status, rejected_at, assessed_at FROM cases WHERE id = ?').get(id));
});

/** Case messages (max 10 per case) */
router.get('/:id/messages', (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  const caseRow = db.prepare('SELECT student_id, assigned_expert_id FROM cases WHERE id = ?').get(caseId);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });
  const allowed = req.userRole === 'admin' || caseRow.student_id === req.userId || caseRow.assigned_expert_id === req.userId;
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  const messages = db.prepare(`
    SELECT m.id, m.message, m.created_at, u.email AS from_email, u.role AS from_role
    FROM case_messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.case_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(caseId, MESSAGE_CAP_PER_CASE);
  res.json({ messages });
});

router.post('/:id/messages', (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  const caseRow = db.prepare('SELECT student_id, assigned_expert_id FROM cases WHERE id = ?').get(caseId);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });
  const allowed = req.userRole === 'admin' || caseRow.student_id === req.userId || caseRow.assigned_expert_id === req.userId;
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  const message = req.body.message != null ? String(req.body.message).trim().slice(0, 500) : '';
  if (!message) return res.status(400).json({ error: 'Message required' });

  db.prepare('INSERT INTO case_messages (case_id, user_id, message) VALUES (?, ?, ?)').run(caseId, req.userId, message);
  const count = db.prepare('SELECT COUNT(*) as c FROM case_messages WHERE case_id = ?').get(caseId).c;
  if (count > MESSAGE_CAP_PER_CASE) {
    const toDel = count - MESSAGE_CAP_PER_CASE;
    db.prepare(
      'DELETE FROM case_messages WHERE id IN (SELECT id FROM case_messages WHERE case_id = ? ORDER BY created_at ASC LIMIT ?)'
    ).run(caseId, toDel);
  }
  const row = db.prepare('SELECT id, message, created_at FROM case_messages WHERE id = last_insert_rowid()').get();
  logEvent('case', caseId, 'message_added', req.userId, {});
  res.status(201).json(row);
});

/** Additional fields (max 10) */
router.get('/:id/fields', (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  const caseRow = db.prepare('SELECT student_id, assigned_expert_id FROM cases WHERE id = ?').get(caseId);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });
  const allowed = req.userRole === 'admin' || caseRow.student_id === req.userId || caseRow.assigned_expert_id === req.userId;
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  const fields = db.prepare('SELECT field_key, field_value, created_at FROM case_additional_fields WHERE case_id = ? ORDER BY created_at').all(caseId);
  res.json({ fields });
});

router.patch('/:id/fields', (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  const caseRow = db.prepare('SELECT student_id FROM cases WHERE id = ?').get(caseId);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });
  if (req.userRole !== 'admin' && caseRow.student_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

  const fields = req.body.fields;
  if (!Array.isArray(fields) || fields.length > ADDITIONAL_FIELDS_LIMIT) {
    return res.status(400).json({ error: `Provide up to ${ADDITIONAL_FIELDS_LIMIT} fields` });
  }

  db.prepare('DELETE FROM case_additional_fields WHERE case_id = ?').run(caseId);
  for (const f of fields.slice(0, ADDITIONAL_FIELDS_LIMIT)) {
    const k = String(f.key || f.field_key || '').slice(0, 50);
    const v = String(f.value || f.field_value || '').slice(0, 500);
    if (k) db.prepare('INSERT INTO case_additional_fields (case_id, field_key, field_value) VALUES (?, ?, ?)').run(caseId, k, v);
  }
  const updated = db.prepare('SELECT field_key, field_value, created_at FROM case_additional_fields WHERE case_id = ?').all(caseId);
  res.json({ fields: updated });
});

/** Case updates / audit */
router.get('/:id/updates', (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  const caseRow = db.prepare('SELECT student_id, assigned_expert_id FROM cases WHERE id = ?').get(caseId);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });
  const allowed = req.userRole === 'admin' || caseRow.student_id === req.userId || caseRow.assigned_expert_id === req.userId;
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  const updates = db.prepare(`
    SELECT u.from_status, u.to_status, u.changed_at, u.note,
           cu.email AS changed_by_email, cu.role AS changed_by_role
    FROM case_updates u
    JOIN users cu ON cu.id = u.changed_by
    WHERE u.case_id = ?
    ORDER BY u.changed_at DESC
  `).all(caseId);
  res.json({ updates });
});

/** Event log for case */
router.get('/:id/events', (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  const caseRow = db.prepare('SELECT student_id, assigned_expert_id FROM cases WHERE id = ?').get(caseId);
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const events = db.prepare(`
    SELECT e.id, e.event_type, e.payload, e.created_at, u.email AS actor_email
    FROM event_log e
    LEFT JOIN users u ON u.id = e.actor_id
    WHERE e.entity_type = 'case' AND e.entity_id = ?
    ORDER BY e.created_at DESC
  `).all(caseId);
  res.json({ events });
});

export default router;
