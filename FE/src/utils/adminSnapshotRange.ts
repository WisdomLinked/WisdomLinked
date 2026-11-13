export type SnapshotRangeKey = '3m' | '6m' | '1y' | 'all' | 'custom';

export type SnapshotCustomRange = { startDate: string; endDate: string };

export const SNAPSHOT_RANGE_OPTIONS: ReadonlyArray<{ value: SnapshotRangeKey; label: string }> = [
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
];

export const DEFAULT_SNAPSHOT_RANGE: SnapshotRangeKey = '6m';

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isSnapshotDateInput(value: string): boolean {
  const match = YMD.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function snapshotCustomRangeValid(startDate: string, endDate: string): boolean {
  return isSnapshotDateInput(startDate) && isSnapshotDateInput(endDate) && endDate >= startDate;
}

export function parseSnapshotRangeKey(raw: string | null | undefined): SnapshotRangeKey {
  if (raw === '3m' || raw === '6m' || raw === '1y' || raw === 'all' || raw === 'custom') return raw;
  return DEFAULT_SNAPSHOT_RANGE;
}

export function parseSnapshotCustomRange(
  search: Pick<URLSearchParams, 'get'>,
): SnapshotCustomRange | null {
  const startDate = (search.get('startDate') || '').trim();
  const endDate = (search.get('endDate') || '').trim();
  if (!snapshotCustomRangeValid(startDate, endDate)) return null;
  return { startDate, endDate };
}

export function resolveSnapshotSelection(search: Pick<URLSearchParams, 'get'>): {
  rangeKey: SnapshotRangeKey;
  customRange: SnapshotCustomRange | null;
} {
  const rangeKey = parseSnapshotRangeKey(search.get('range'));
  if (rangeKey !== 'custom') return { rangeKey, customRange: null };
  const customRange = parseSnapshotCustomRange(search);
  if (!customRange) return { rangeKey: DEFAULT_SNAPSHOT_RANGE, customRange: null };
  return { rangeKey: 'custom', customRange };
}

function localDayStart(ymd: string): Date {
  const match = YMD.exec(ymd);
  if (!match) return new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Inclusive start, exclusive end of the day after `endDate`. */
export function snapshotCustomBounds(custom: SnapshotCustomRange): { dateFrom: string; dateTo: string } {
  const from = localDayStart(custom.startDate);
  const to = localDayStart(custom.endDate);
  to.setDate(to.getDate() + 1);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

export function snapshotRangeBounds(
  key: SnapshotRangeKey,
  now: Date = new Date(),
  custom?: SnapshotCustomRange | null,
): { dateFrom?: string; dateTo?: string } {
  if (key === 'all') return {};
  if (key === 'custom') {
    if (!custom || !snapshotCustomRangeValid(custom.startDate, custom.endDate)) return {};
    return snapshotCustomBounds(custom);
  }
  // Start at local midnight on the 1st of the first month the chart shows, so the cards and the
  // bars cover the same days: 3 months on Nov 12 → Sep 1 to now. The server groups the bars by
  // the same local months (the browser time zone is sent with the request).
  const months = key === '3m' ? 3 : key === '6m' ? 6 : 12;
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return { dateFrom: from.toISOString(), dateTo: new Date(now).toISOString() };
}

function formatDay(date: Date, withYear: boolean): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' as const } : {}),
  });
}

export function formatSnapshotDateRange(startDate: string, endDate: string): string {
  const start = localDayStart(startDate);
  const end = localDayStart(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Custom range';
  if (startDate === endDate) return formatDay(start, true);
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${formatDay(start, !sameYear)} – ${formatDay(end, true)}`;
}

export function snapshotRangeDescription(
  key: SnapshotRangeKey,
  custom?: SnapshotCustomRange | null,
): string {
  if (key === 'custom') {
    return custom ? formatSnapshotDateRange(custom.startDate, custom.endDate) : 'Custom range';
  }
  if (key === '3m') return 'Last 3 months';
  if (key === '6m') return 'Last 6 months';
  if (key === '1y') return 'Last 12 months';
  return 'All time';
}

export function snapshotRangePhrase(
  key: SnapshotRangeKey,
  custom?: SnapshotCustomRange | null,
): string {
  if (key === 'custom') {
    return custom ? formatSnapshotDateRange(custom.startDate, custom.endDate) : 'custom range';
  }
  if (key === '3m') return 'last 3 months';
  if (key === '6m') return 'last 6 months';
  if (key === '1y') return 'last 12 months';
  return 'all time';
}

export function snapshotRangeQuery(
  key: SnapshotRangeKey,
  custom?: SnapshotCustomRange | null,
): string {
  const params = new URLSearchParams();
  params.set('range', key);
  if (key === 'custom' && custom) {
    params.set('startDate', custom.startDate);
    params.set('endDate', custom.endDate);
  }
  return `?${params.toString()}`;
}

/** `YYYY-MM` of the local calendar month `d` falls in (the same months the server groups by). */
export function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Inclusive month keys from `first` through `last` (`YYYY-MM`). */
export function monthKeysInclusive(first: string, last: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(first) || !/^\d{4}-\d{2}$/.test(last) || first > last) return [];
  const keys: string[] = [];
  let [y, m] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

/** Last `count` calendar months ending at `now`'s month (e.g. 3 → Sep, Oct, Nov). */
export function trailingMonthKeys(count: number, now: Date = new Date()): string[] {
  const n = Math.max(0, Math.floor(count));
  if (!n) return [];
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(end.getFullYear(), end.getMonth() - (n - 1), 1);
  return monthKeysInclusive(monthKeyFromDate(start), monthKeyFromDate(end));
}

/**
 * Shared month axis for snapshot mini-charts so every tile shows the same bar count:
 * 3m → 3, 6m → 6, 1y → 12, custom → months in range, all → earliest data month through now.
 */
export function snapshotChartMonthKeys(
  key: SnapshotRangeKey,
  custom?: SnapshotCustomRange | null,
  dataMonths: string[] = [],
  now: Date = new Date(),
): string[] {
  if (key === '3m') return trailingMonthKeys(3, now);
  if (key === '6m') return trailingMonthKeys(6, now);
  if (key === '1y') return trailingMonthKeys(12, now);
  if (key === 'custom' && custom && snapshotCustomRangeValid(custom.startDate, custom.endDate)) {
    const startMonth = custom.startDate.slice(0, 7);
    const endMonth = custom.endDate.slice(0, 7);
    return monthKeysInclusive(startMonth, endMonth);
  }
  const valid = dataMonths.filter(m => /^\d{4}-\d{2}$/.test(m)).sort();
  const current = monthKeyFromDate(now);
  if (!valid.length) return [current];
  const first = valid[0];
  const last = valid[valid.length - 1] > current ? valid[valid.length - 1] : current;
  return monthKeysInclusive(first, last);
}

export function alignMonthlyPoints<T extends { month: string; count: number }>(
  keys: string[],
  points: T[] | undefined,
): Array<T | { month: string; count: number }> {
  const byMonth = new Map((points || []).map(p => [p.month, p]));
  return keys.map(month => {
    const hit = byMonth.get(month);
    return hit || { month, count: 0 };
  });
}
