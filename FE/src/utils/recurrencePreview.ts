// Expands a repeat rule to the dates it will produce, so the expert sees the real
// series before saving. Mirrors the backend's stepping rules: calendar days (not
// fixed 24h hops), month-end clamping, and the same bounds.

export type RecurrenceUnit = 'day' | 'week' | 'month';
export type RecurrenceEndMode = 'count' | 'until' | 'horizon';

/** Matches MAX_RECURRENCE_OCCURRENCES on the backend. */
export const MAX_RECURRENCE_OCCURRENCES = 500;
export const MAX_RECURRENCE_INTERVAL = 30;
/** How far a series with no explicit end runs. */
export const DEFAULT_RECURRENCE_HORIZON_YEARS = 1;

export interface RecurrenceInput {
  start: Date | null;
  unit: RecurrenceUnit;
  interval: number;
  /** Weekly rules only: days of the week, 0 = Sunday. Fewer than two means "same day as the start". */
  weekdays?: number[] | null;
  endMode: RecurrenceEndMode;
  count?: number | null;
  /** YYYY-MM-DD, as typed in the form. */
  until?: string | null;
}

export interface RecurrencePreview {
  dates: Date[];
  /** True when the rule wanted more sessions than the guard allows. */
  overLimit: boolean;
}

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const addUnits = (base: Date, unit: RecurrenceUnit, n: number): Date => {
  if (unit === 'month') {
    const shifted = base.getMonth() + n;
    const year = base.getFullYear() + Math.floor(shifted / 12);
    const month = ((shifted % 12) + 12) % 12;
    const day = Math.min(base.getDate(), daysInMonth(year, month));
    return new Date(year, month, day, base.getHours(), base.getMinutes(), base.getSeconds());
  }
  const days = unit === 'week' ? n * 7 : n;
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + days,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
  );
};

/** Sorted, deduped, in-range — and only meaningful on a weekly rule. */
export const normalizeWeekdays = (unit: RecurrenceUnit, raw: unknown): number[] | null => {
  if (unit !== 'week' || !Array.isArray(raw)) return null;
  const days = Array.from(
    new Set(raw.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
  ).sort((a, b) => a - b);
  return days.length > 1 ? days : null;
};

export const previewRecurrence = (input: RecurrenceInput): RecurrencePreview => {
  const { start, unit, interval } = input;
  if (!start || Number.isNaN(start.getTime())) return { dates: [], overLimit: false };
  if (!Number.isInteger(interval) || interval < 1 || interval > MAX_RECURRENCE_INTERVAL) {
    return { dates: [], overLimit: false };
  }

  // The end of the day is used so a series ending "on" a date includes it.
  const untilMs = input.endMode === 'until' && input.until
    ? new Date(`${input.until}T23:59:59`).getTime()
    : null;
  if (input.endMode === 'until' && (untilMs === null || Number.isNaN(untilMs))) {
    return { dates: [], overLimit: false };
  }

  const horizon = new Date(start);
  horizon.setFullYear(horizon.getFullYear() + DEFAULT_RECURRENCE_HORIZON_YEARS);

  const wanted = input.endMode === 'count' && Number.isInteger(input.count) && (input.count as number) > 0
    ? (input.count as number)
    : Infinity;
  const limit = Math.min(wanted, MAX_RECURRENCE_OCCURRENCES);

  const weekdays = normalizeWeekdays(unit, input.weekdays);
  const baseWeekday = start.getDay();

  // Weekly-on-named-days walks whole weeks and emits each selected day inside
  // them; every other rule is a straight step from the start date.
  const candidateAt = (n: number): Date | null => {
    if (!weekdays) return addUnits(start, unit, n * interval);
    const block = Math.floor(n / weekdays.length);
    const dayOfWeek = weekdays[n % weekdays.length];
    const weekAnchor = addUnits(start, 'day', -baseWeekday + block * interval * 7);
    const occurrence = addUnits(weekAnchor, 'day', dayOfWeek);
    return occurrence.getTime() < start.getTime() ? null : occurrence;
  };

  const dates: Date[] = [];
  // The start is always the first session, even when the expert picked weekdays
  // that don't include the day they started on.
  if (weekdays && !weekdays.includes(baseWeekday)) dates.push(start);

  for (let n = 0; dates.length < limit; n += 1) {
    const occurrence = candidateAt(n);
    if (!occurrence) continue;
    if (untilMs !== null) {
      if (occurrence.getTime() > untilMs) break;
    } else if (wanted === Infinity && occurrence >= horizon) {
      break;
    }
    dates.push(occurrence);
  }

  // Hitting the cap exactly is only "over" when the rule wanted more than it.
  const overLimit =
    dates.length >= MAX_RECURRENCE_OCCURRENCES &&
    (wanted > MAX_RECURRENCE_OCCURRENCES || untilMs !== null);
  return { dates, overLimit };
};

const fmt = (d: Date) =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** "18 sessions · Sep 1, 2026 → Nov 5, 2026", or null when there is nothing to show. */
export const previewSummary = (preview: RecurrencePreview): string | null => {
  const { dates } = preview;
  if (dates.length === 0) return null;
  if (dates.length === 1) return `1 session · ${fmt(dates[0])}`;
  return `${dates.length} sessions · ${fmt(dates[0])} → ${fmt(dates[dates.length - 1])}`;
};
