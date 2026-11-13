import { describe, expect, it } from 'vitest';
import {
  alignMonthlyPoints,
  monthKeysInclusive,
  DEFAULT_SNAPSHOT_RANGE,
  parseSnapshotRangeKey,
  resolveSnapshotSelection,
  snapshotChartMonthKeys,
  snapshotCustomRangeValid,
  snapshotRangeBounds,
  snapshotRangeDescription,
  snapshotRangePhrase,
  snapshotRangeQuery,
  trailingMonthKeys,
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

  it('6 months starts on the 1st of the first charted month, so cards and bars cover the same days', () => {
    const now = new Date(2026, 9, 21, 12);
    const bounds = snapshotRangeBounds('6m', now);
    expect(bounds.dateTo).toBe(now.toISOString());
    expect(bounds.dateFrom).toBe(new Date(2026, 4, 1).toISOString());
    expect(trailingMonthKeys(6, now)[0]).toBe(bounds.dateFrom!.slice(0, 7));
    expect(snapshotRangeDescription('6m')).toBe('Last 6 months');
    expect(snapshotRangePhrase('6m')).toBe('last 6 months');
    expect(snapshotRangePhrase('all')).toBe('all time');
  });

  it.each([
    ['3m', 3, new Date(2026, 8, 1), '2026-09'],
    ['6m', 6, new Date(2026, 5, 1), '2026-06'],
    ['1y', 12, new Date(2025, 11, 1), '2025-12'],
  ] as const)('%s starts at local midnight on the 1st of the first of its %i chart months, across a year boundary too', (key, n, start, firstMonth) => {
    const now = new Date(2026, 10, 12, 15);
    const bounds = snapshotRangeBounds(key, now);
    expect(bounds.dateFrom).toBe(start.toISOString());
    expect(bounds.dateTo).toBe(now.toISOString());
    expect(snapshotChartMonthKeys(key, null, [], now)[0]).toBe(firstMonth);
    expect(snapshotChartMonthKeys(key, null, [], now)).toHaveLength(n);
  });

  it('the start and the chart months both follow the local calendar, so they always agree', () => {
    // The last evening of November, local time: still November on both the start and the bars.
    const now = new Date(2026, 10, 30, 23, 30);
    expect(snapshotRangeBounds('3m', now).dateFrom).toBe(new Date(2026, 8, 1).toISOString());
    expect(snapshotChartMonthKeys('3m', null, [], now)).toEqual(['2026-09', '2026-10', '2026-11']);
    // Just after midnight on Dec 1, local: both move on together.
    const next = new Date(2026, 11, 1, 0, 30);
    expect(snapshotRangeBounds('3m', next).dateFrom).toBe(new Date(2026, 9, 1).toISOString());
    expect(snapshotChartMonthKeys('3m', null, [], next)).toEqual(['2026-10', '2026-11', '2026-12']);
  });

  it('monthKeysInclusive walks months as plain calendar text, across a year boundary', () => {
    expect(monthKeysInclusive('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthKeysInclusive('2026-05', '2026-04')).toEqual([]);
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

  it('chart month keys match the selected range length for every tile', () => {
    const now = new Date(Date.UTC(2026, 10, 9)); // Nov 9, 2026
    expect(trailingMonthKeys(3, now)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(snapshotChartMonthKeys('3m', null, [], now)).toHaveLength(3);
    expect(snapshotChartMonthKeys('6m', null, [], now)).toHaveLength(6);
    expect(snapshotChartMonthKeys('1y', null, [], now)).toHaveLength(12);
    expect(
      snapshotChartMonthKeys('custom', { startDate: '2026-01-15', endDate: '2026-03-02' }, [], now),
    ).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(
      snapshotChartMonthKeys('all', null, ['2026-08', '2026-10'], now),
    ).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    expect(alignMonthlyPoints(['2026-09', '2026-10'], [{ month: '2026-10', count: 4 }])).toEqual([
      { month: '2026-09', count: 0 },
      { month: '2026-10', count: 4 },
    ]);
  });
});
