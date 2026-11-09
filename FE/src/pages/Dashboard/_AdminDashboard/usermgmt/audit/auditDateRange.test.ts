import { describe, expect, it } from 'vitest';
import {
  EMPTY_AUDIT_RANGE,
  filterConversationBuckets,
  filterPaymentRows,
  isChequeInRange,
  isConversationInRange,
  isDateInRange,
  isRangeActive,
  paymentRangeParams,
  rangeBounds,
} from './auditDateRange';
import type { AuditConversation } from './auditModel';

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

const conversation = (over: Partial<AuditConversation>): AuditConversation => ({
  id: 'c',
  kind: 'seminar',
  title: 'T',
  preview: '',
  initials: 'T',
  participants: [],
  ...over,
});

describe('rangeBounds', () => {
  it('covers whole local days, with "to" inclusive of that entire day', () => {
    const { start, endExclusive } = rangeBounds({ from: '2026-10-01', to: '2026-10-31' });
    expect(start).toBe(new Date(2026, 9, 1).getTime());
    expect(endExclusive).toBe(new Date(2026, 10, 1).getTime());
  });

  it('leaves a blank or malformed side open', () => {
    expect(rangeBounds({ from: '', to: '2026-10-31' }).start).toBeNull();
    expect(rangeBounds({ from: '2026-10-01', to: 'nope' }).endExclusive).toBeNull();
    expect(isRangeActive(EMPTY_AUDIT_RANGE)).toBe(false);
    expect(isRangeActive({ from: 'x', to: '' })).toBe(false);
    expect(isRangeActive({ from: '', to: '2026-10-31' })).toBe(true);
  });
});

describe('isDateInRange', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' };

  it('includes the first and last minute of the range and nothing outside it', () => {
    expect(isDateInRange(local(2026, 10, 1, 0, 0), range)).toBe(true);
    expect(isDateInRange(local(2026, 10, 31, 23, 59), range)).toBe(true);
    expect(isDateInRange(local(2026, 9, 30, 23, 59), range)).toBe(false);
    expect(isDateInRange(local(2026, 11, 1, 0, 0), range)).toBe(false);
  });

  it('keeps everything when no range is set, but drops undated rows once one is', () => {
    expect(isDateInRange(undefined, EMPTY_AUDIT_RANGE)).toBe(true);
    expect(isDateInRange(undefined, range)).toBe(false);
  });

  it('supports open-ended ranges', () => {
    expect(isDateInRange(local(2030, 1, 1), { from: '2026-10-01', to: '' })).toBe(true);
    expect(isDateInRange(local(2020, 1, 1), { from: '', to: '2026-10-31' })).toBe(true);
    expect(isDateInRange(local(2026, 11, 2), { from: '', to: '2026-10-31' })).toBe(false);
  });
});

describe('isConversationInRange', () => {
  const october = { from: '2026-10-01', to: '2026-10-31' };

  it('counts a conversation when its booking, session or latest activity falls in the range', () => {
    const bookedSeptHeldNov = conversation({
      startedAt: local(2026, 11, 5),
      date: local(2026, 11, 5),
      appointmentSource: { createdAt: local(2026, 9, 20) },
    });
    expect(isConversationInRange(bookedSeptHeldNov, october)).toBe(true);
    expect(isConversationInRange(bookedSeptHeldNov, { from: '2026-08-01', to: '2026-08-31' })).toBe(false);
  });

  it('excludes conversations that ended before or began after the range', () => {
    const august = conversation({ startedAt: local(2026, 8, 3), date: local(2026, 8, 20) });
    const december = conversation({ startedAt: local(2026, 12, 3), date: local(2026, 12, 4) });
    expect(isConversationInRange(august, october)).toBe(false);
    expect(isConversationInRange(december, october)).toBe(false);
  });

  it('uses the community creation date and the seminar start', () => {
    expect(
      isConversationInRange(conversation({ kind: 'group', group: { createdAt: local(2026, 10, 9) } as any }), october),
    ).toBe(true);
    expect(isConversationInRange(conversation({ seminar: { start: local(2026, 10, 9) } as any }), october)).toBe(true);
  });

  it('drops a conversation with no dates only when a range is set', () => {
    expect(isConversationInRange(conversation({}), october)).toBe(false);
    expect(isConversationInRange(conversation({}), EMPTY_AUDIT_RANGE)).toBe(true);
  });
});

describe('filterConversationBuckets', () => {
  it('filters every bucket and returns the input untouched with no range', () => {
    const inOct = conversation({ id: 'a', date: local(2026, 10, 9), startedAt: local(2026, 10, 9) });
    const inAug = conversation({ id: 'b', date: local(2026, 8, 9), startedAt: local(2026, 8, 9) });
    const buckets = { group: [inAug], appointments: [inOct], seminars: [inOct, inAug], all: [inOct, inOct, inAug, inAug] };
    expect(filterConversationBuckets(buckets, EMPTY_AUDIT_RANGE)).toBe(buckets);
    const out = filterConversationBuckets(buckets, { from: '2026-10-01', to: '2026-10-31' });
    expect(out.group).toEqual([]);
    expect(out.appointments.map(c => c.id)).toEqual(['a']);
    expect(out.seminars.map(c => c.id)).toEqual(['a']);
    expect(out.all.map(c => c.id)).toEqual(['a', 'a']);
  });
});

describe('filterPaymentRows', () => {
  it('keeps rows created inside the range', () => {
    const rows = [
      { _id: '1', createdAt: local(2026, 10, 2) },
      { _id: '2', createdAt: local(2026, 9, 2) },
    ] as any;
    expect(filterPaymentRows(rows, { from: '2026-10-01', to: '' }).map((r: any) => r._id)).toEqual(['1']);
    expect(filterPaymentRows(rows, EMPTY_AUDIT_RANGE)).toBe(rows);
  });
});

describe('isChequeInRange', () => {
  it('never brings in the next month for a range ending on the last day of a month', () => {
    const october = { year: 2026, month: 10, amountCents: 1 };
    const september = { year: 2026, month: 9, amountCents: 1 };
    expect(isChequeInRange(october, { from: '2026-09-01', to: '2026-09-30' })).toBe(false);
    expect(isChequeInRange(september, { from: '2026-09-01', to: '2026-09-30' })).toBe(true);
    expect(isChequeInRange(september, { from: '2026-10-01', to: '' })).toBe(false);
    expect(isChequeInRange(october, { from: '', to: '2026-09-30' })).toBe(false);
    expect(isChequeInRange(october, { from: '', to: '2026-10-01' })).toBe(true);
  });

  it('counts a cheque when its payroll month touches the range', () => {
    expect(isChequeInRange({ year: 2026, month: 10, amountCents: 1 }, { from: '2026-10-15', to: '2026-10-16' })).toBe(true);
    expect(isChequeInRange({ year: 2026, month: 9, amountCents: 1 }, { from: '2026-10-15', to: '2026-10-31' })).toBe(false);
    expect(isChequeInRange({ year: 2026, month: 11, amountCents: 1 }, { from: '2026-10-15', to: '2026-10-31' })).toBe(false);
    expect(isChequeInRange({ year: 2026, month: 13, amountCents: 1 }, { from: '2026-10-15', to: '' })).toBe(false);
    expect(isChequeInRange({ year: 2026, month: 1, amountCents: 1 }, EMPTY_AUDIT_RANGE)).toBe(true);
  });
});

describe('paymentRangeParams', () => {
  it('sends the first day\'s start and the day after the last day, matching the server\'s >= and <', () => {
    const params = paymentRangeParams({ from: '2026-10-01', to: '2026-10-31' });
    expect(params.dateFrom).toBe(new Date(2026, 9, 1).toISOString());
    expect(params.dateTo).toBe(new Date(2026, 10, 1).toISOString());
  });

  it('sends nothing for an empty range and only the set side otherwise', () => {
    expect(paymentRangeParams(EMPTY_AUDIT_RANGE)).toEqual({});
    expect(Object.keys(paymentRangeParams({ from: '', to: '2026-10-31' }))).toEqual(['dateTo']);
  });
});
