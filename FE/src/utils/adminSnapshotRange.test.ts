import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SNAPSHOT_RANGE,
  parseSnapshotRangeKey,
  snapshotRangeBounds,
  snapshotRangeDescription,
  snapshotRangePhrase,
} from './adminSnapshotRange';

describe('adminSnapshotRange', () => {
  it('defaults unknown keys to 6 months', () => {
    expect(parseSnapshotRangeKey(null)).toBe(DEFAULT_SNAPSHOT_RANGE);
    expect(parseSnapshotRangeKey('nope')).toBe('6m');
    expect(parseSnapshotRangeKey('1y')).toBe('1y');
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
});
