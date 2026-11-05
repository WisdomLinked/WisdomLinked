import type { PaymentHistoryRow } from '../../payment/paymentHistoryUtils';
import { parseDate, type AuditCheque, type AuditConversation } from './auditModel';

/** Days picked in the audit window, as YYYY-MM-DD; an empty side is open-ended. */
export type AuditDateRange = { from: string; to: string };

export const EMPTY_AUDIT_RANGE: AuditDateRange = { from: '', to: '' };

type Bounds = { start: number | null; endExclusive: number | null };

function localDayStart(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || '').trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

/** Whole days in the admin's own time zone: "to" includes all of that day. */
export function rangeBounds(range: AuditDateRange): Bounds {
  const start = localDayStart(range.from);
  const toStart = localDayStart(range.to);
  let endExclusive: number | null = null;
  if (toStart !== null) {
    const next = new Date(toStart);
    next.setDate(next.getDate() + 1);
    endExclusive = next.getTime();
  }
  return { start, endExclusive };
}

export function isRangeActive(range: AuditDateRange): boolean {
  const { start, endExclusive } = rangeBounds(range);
  return start !== null || endExclusive !== null;
}

function overlaps(spanStart: number, spanEnd: number, bounds: Bounds): boolean {
  if (bounds.start !== null && spanEnd < bounds.start) return false;
  if (bounds.endExclusive !== null && spanStart >= bounds.endExclusive) return false;
  return true;
}

export function isDateInRange(value: string | Date | null | undefined, range: AuditDateRange): boolean {
  if (!isRangeActive(range)) return true;
  const date = parseDate(value);
  if (!date) return false;
  return overlaps(date.getTime(), date.getTime(), rangeBounds(range));
}

/**
 * A conversation counts when anything on it falls in the range — when it was booked or
 * created, its session, or its latest activity — so a seminar booked in September and
 * held in October shows for either month.
 */
export function isConversationInRange(item: AuditConversation, range: AuditDateRange): boolean {
  if (!isRangeActive(range)) return true;
  const times = [
    item.date,
    item.group?.createdAt,
    item.appointmentSource?.createdAt,
    item.seminar?.start,
  ]
    .map(value => parseDate(value)?.getTime())
    .filter((time): time is number => typeof time === 'number');
  if (times.length === 0) return false;
  return overlaps(Math.min(...times), Math.max(...times), rangeBounds(range));
}

export function filterConversationBuckets<
  T extends { group: AuditConversation[]; appointments: AuditConversation[]; seminars: AuditConversation[]; all: AuditConversation[] },
>(buckets: T, range: AuditDateRange): T {
  if (!isRangeActive(range)) return buckets;
  const keep = (items: AuditConversation[]) => items.filter(item => isConversationInRange(item, range));
  return {
    ...buckets,
    group: keep(buckets.group),
    appointments: keep(buckets.appointments),
    seminars: keep(buckets.seminars),
    all: keep(buckets.all),
  };
}

export function filterPaymentRows(rows: PaymentHistoryRow[], range: AuditDateRange): PaymentHistoryRow[] {
  if (!isRangeActive(range)) return rows;
  return rows.filter(row => isDateInRange(row.createdAt, range));
}

/**
 * A cheque pays a named payroll month, so it is matched against the months picked rather than
 * against instants: "Sep 1 – Sep 30" never brings in October's cheque, in any time zone.
 */
export function isChequeInRange(cheque: AuditCheque, range: AuditDateRange): boolean {
  if (!isRangeActive(range)) return true;
  const year = Number(cheque.year);
  const month = Number(cheque.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return false;
  const key = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const { start, endExclusive } = rangeBounds(range);
  if (start !== null && key < range.from.trim().slice(0, 7)) return false;
  if (endExclusive !== null && key > range.to.trim().slice(0, 7)) return false;
  return true;
}

/** `filterPaymentHistories` compares `createdAt > dateFrom` and `< dateTo`. */
export function paymentRangeParams(range: AuditDateRange): { dateFrom?: string; dateTo?: string } {
  const { start, endExclusive } = rangeBounds(range);
  const params: { dateFrom?: string; dateTo?: string } = {};
  if (start !== null) params.dateFrom = new Date(start - 1).toISOString();
  if (endExclusive !== null) params.dateTo = new Date(endExclusive).toISOString();
  return params;
}
