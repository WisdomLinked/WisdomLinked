export type SnapshotRangeKey = '3m' | '6m' | '1y' | 'all';

export const SNAPSHOT_RANGE_OPTIONS: ReadonlyArray<{ value: SnapshotRangeKey; label: string }> = [
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
  { value: 'all', label: 'All time' },
];

export const DEFAULT_SNAPSHOT_RANGE: SnapshotRangeKey = '6m';

export function parseSnapshotRangeKey(raw: string | null | undefined): SnapshotRangeKey {
  if (raw === '3m' || raw === '6m' || raw === '1y' || raw === 'all') return raw;
  return DEFAULT_SNAPSHOT_RANGE;
}

export function snapshotRangeBounds(
  key: SnapshotRangeKey,
  now: Date = new Date(),
): { dateFrom?: string; dateTo?: string } {
  if (key === 'all') return {};
  const to = new Date(now);
  const from = new Date(now);
  if (key === '3m') from.setMonth(from.getMonth() - 3);
  else if (key === '6m') from.setMonth(from.getMonth() - 6);
  else from.setFullYear(from.getFullYear() - 1);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

export function snapshotRangeDescription(key: SnapshotRangeKey): string {
  if (key === '3m') return 'Last 3 months';
  if (key === '6m') return 'Last 6 months';
  if (key === '1y') return 'Last 12 months';
  return 'All time';
}

export function snapshotRangePhrase(key: SnapshotRangeKey): string {
  if (key === '3m') return 'last 3 months';
  if (key === '6m') return 'last 6 months';
  if (key === '1y') return 'last 12 months';
  return 'all time';
}
