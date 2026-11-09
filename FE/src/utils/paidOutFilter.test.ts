import { describe, expect, it } from 'vitest';
import {
  EMPTY_PAID_OUT_FILTERS,
  chequeDay,
  countPaidOutFilters,
  filterPaidOut,
  formatChequeDate,
  payrollMonthLabel,
  type PaidOutCheque,
} from './paidOutFilter';

const rows: PaidOutCheque[] = [
  { _id: 'a', expertName: 'Ada Lovelace', expertEmail: 'ada@lab.com', chequeNumber: '88421', chequeDate: '2026-11-02T00:00:00.000Z' },
  { _id: 'b', expertName: 'Grace Hopper', expertEmail: 'grace@navy.mil', chequeNumber: 'TXN-77', chequeDate: '2026-10-15T00:00:00.000Z' },
  { _id: 'c', expertName: '', expertEmail: 'nameless@x.com', chequeNumber: '', chequeDate: null },
];
const ids = (list: PaidOutCheque[]) => list.map(row => row._id);
const run = (patch: Partial<typeof EMPTY_PAID_OUT_FILTERS>) => ids(filterPaidOut(rows, { ...EMPTY_PAID_OUT_FILTERS, ...patch }));

describe('filterPaidOut', () => {
  it('returns everything with no filters', () => {
    expect(run({})).toEqual(['a', 'b', 'c']);
  });

  it('matches part of the expert name or email, ignoring case and spaces around it', () => {
    expect(run({ expert: '  HOPPER ' })).toEqual(['b']);
    expect(run({ expert: 'lab.com' })).toEqual(['a']);
    expect(run({ expert: 'nameless' })).toEqual(['c']);
    expect(run({ expert: 'zzz' })).toEqual([]);
  });

  it('matches part of the cheque or reference number, ignoring case', () => {
    expect(run({ number: 'txn' })).toEqual(['b']);
    expect(run({ number: '842' })).toEqual(['a']);
  });

  it('includes both the From and the To day', () => {
    expect(run({ from: '2026-10-15' })).toEqual(['a', 'b']);
    expect(run({ to: '2026-10-15' })).toEqual(['b']);
    expect(run({ from: '2026-10-16', to: '2026-11-01' })).toEqual([]);
    expect(run({ from: '2026-11-02', to: '2026-11-02' })).toEqual(['a']);
  });

  it('leaves out a payout with no date once a date filter is set', () => {
    expect(run({ from: '2000-01-01' })).not.toContain('c');
  });

  it('needs every filter to match', () => {
    expect(run({ expert: 'ada', number: 'TXN' })).toEqual([]);
    expect(run({ expert: 'grace', number: 'TXN', from: '2026-10-01' })).toEqual(['b']);
  });
});

describe('paid-out helpers', () => {
  it('reads the stored UTC day, whatever the local time zone', () => {
    expect(chequeDay('2026-11-02T00:00:00.000Z')).toBe('2026-11-02');
    expect(chequeDay('not a date')).toBe('');
    expect(formatChequeDate('2026-11-02T00:00:00.000Z')).toBe('Nov 2, 2026');
    expect(formatChequeDate(null)).toBe('—');
  });

  it('names the payroll month, or a dash when it is missing', () => {
    expect(payrollMonthLabel(2026, 9)).toBe('September 2026');
    expect(payrollMonthLabel(2026, undefined)).toBe('—');
  });

  it('counts only filters that hold something', () => {
    expect(countPaidOutFilters({ expert: ' ', number: 'x', from: '', to: '2026-01-01' })).toBe(2);
  });
});
