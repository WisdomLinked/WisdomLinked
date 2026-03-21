import { db } from '../db.js';
import { CaseStatus } from '../constants/caseStatus.js';

const OVERDUE_STATUSES = [
  CaseStatus.SUBMITTED,
  CaseStatus.ASSIGNED,
  CaseStatus.UNDER_REVIEW,
  CaseStatus.NEEDS_INFO,
  CaseStatus.RESUBMITTED,
];

export function runSlaJob() {
  try {
    const now = new Date().toISOString();
    const rows = db.prepare(`
      SELECT id, case_id, status, student_id
      FROM cases
      WHERE status IN (${OVERDUE_STATUSES.map(() => '?').join(',')})
        AND due_at IS NOT NULL
        AND due_at < ?
    `).all(...OVERDUE_STATUSES, now);

    for (const row of rows) {
      db.prepare('UPDATE cases SET status = ? WHERE id = ?').run(CaseStatus.OVERDUE, row.id);
      try {
        db.prepare(
          'INSERT INTO event_log (entity_type, entity_id, event_type, actor_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run('case', row.id, 'status_change', null, JSON.stringify({
          from: row.status,
          to: CaseStatus.OVERDUE,
          reason: 'SLA exceeded (5 days)',
        }), now);
      } catch (_) {}
    }
    return rows.length;
  } catch (err) {
    console.error('SLA job error:', err);
    return 0;
  }
}
