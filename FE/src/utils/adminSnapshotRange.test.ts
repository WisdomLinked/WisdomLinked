import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SNAPSHOT_RANGE,
  parseSnapshotRangeKey,
  resolveSnapshotSelection,
  snapshotCustomRangeValid,
  snapshotRangeBounds,
  snapshotRangeDescription,
  snapshotRangePhrase,
  snapshotRangeQuery,
} from './adminSnapshotRange';

describe('adminSnapshotRange', () => {
  it('defaults unknown keys to 6 months', () => {
    expect(parseSnapshotRangeKey(null)).toBe(DEFAULT_SNAPSHOT_RANGE);
    expect(parseSnapshotRangeKey('nope')).toBe('6m');
    expect(parseSnapshotRangeKey('1y')).toBe('1y');
    expect(parseSnapshotRangeKey('custom')).toBe('custom');
  });

  it('all-time has no date bounds', () => {
    expect(snapshotRangeBounds('all')).toEqual({});
    expect(snapshotRangeDescription('all')).toBe('All time');
  });

  it('6 months is calendar months before now', () => {
    const now = new Date('2026-10-21T12:00:00.000Z');
    const bounds = snapshotRangeBounds('6m', now);
    expect(bounds.dateTo).toBe(now.toISOString());
    expect(bounds.dateFrom).toBe(new Date('2026-04-21T12:00:00.000Z').toISOString());
    expect(snapshotRangeDescription('6m')).toBe('Last 6 months');
    expect(snapshotRangePhrase('6m')).toBe('last 6 months');
    expect(snapshotRangePhrase('all')).toBe('all time');
  });

  it('custom range maps calendar days to inclusive start and exclusive next-day end', () => {
    expect(snapshotCustomRangeValid('2026-03-31', '2026-01-01')).toBe(false);
    const bounds = snapshotRangeBounds('custom', new Date(), {
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(new Date(bounds.dateFrom || '').getTime()).toBe(new Date(2026, 0, 1).getTime());
    expect(new Date(bounds.dateTo || '').getTime()).toBe(new Date(2026, 1, 1).getTime());
    const ms = Date.parse(bounds.dateTo || '') - Date.parse(bounds.dateFrom || '');
    const previousFrom = Date.parse(bounds.dateFrom || '') - ms;
    expect(new Date(previousFrom).getTime()).toBe(new Date(2025, 11, 1).getTime());
    expect(snapshotRangeDescription('custom', { startDate: '2026-01-01', endDate: '2026-03-31' })).toContain('2026');
    expect(snapshotRangeQuery('custom', { startDate: '2026-01-01', endDate: '2026-03-31' })).toBe(
      '?range=custom&startDate=2026-01-01&endDate=2026-03-31',
    );
  });

  it('falls back from custom when start/end are missing or inverted', () => {
    const params = new URLSearchParams('range=custom&startDate=2026-03-31&endDate=2026-01-01');
    expect(resolveSnapshotSelection(params)).toEqual({
      rangeKey: DEFAULT_SNAPSHOT_RANGE,
      customRange: null,
    });
    const ok = new URLSearchParams('range=custom&startDate=2026-01-01&endDate=2026-03-31');
    expect(resolveSnapshotSelection(ok)).toEqual({
      rangeKey: 'custom',
      customRange: { startDate: '2026-01-01', endDate: '2026-03-31' },
    });
  });
});
