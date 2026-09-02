// One description of a seminar's repeat schedule, shared by every surface that
// shows one. Seminars created before flexible recurrence carry only the legacy
// `recurrenceFrequency` enum, so both shapes are read here.

export type RecurrenceUnit = 'day' | 'week' | 'month';

export interface RecurrenceFields {
  isRecurring?: boolean;
  recurrenceUnit?: RecurrenceUnit | string | null;
  recurrenceInterval?: number | null;
  recurrenceWeekdays?: number[] | null;
  recurrenceCount?: number | null;
  recurrenceUntil?: string | Date | null;
  recurrenceFrequency?: string | null;
}

const LEGACY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
};

const UNIT_LABELS: Record<string, string> = { day: 'day', week: 'week', month: 'month' };

/** Sunday-first, matching Date#getDay. */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const weekdaysOf = (g: RecurrenceFields): number[] | null => {
  if (g.recurrenceUnit !== 'week' || !Array.isArray(g.recurrenceWeekdays)) return null;
  const days = Array.from(
    new Set(g.recurrenceWeekdays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
  ).sort((a, b) => a - b);
  return days.length > 1 ? days : null;
};

/** "Mon, Wed & Fri" */
export const weekdayList = (days: number[]): string => {
  const names = days.map((d) => WEEKDAY_LABELS[d]);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
};

/** "Weekly", "Biweekly", "Monthly", "Daily", or "Every 3 days". Undefined when it doesn't repeat. */
export const recurrenceLabel = (g: RecurrenceFields | null | undefined): string | undefined => {
  if (!g?.isRecurring) return undefined;

  const unit = typeof g.recurrenceUnit === 'string' ? g.recurrenceUnit : '';
  const interval = Number(g.recurrenceInterval);
  if (UNIT_LABELS[unit] && Number.isInteger(interval) && interval > 0) {
    // A seminar on named days is described by those days, not by its cadence:
    // "Mondays and Fridays" is what the student needs to read.
    const days = weekdaysOf(g);
    if (days) {
      const on = `on ${weekdayList(days)}`;
      return interval === 1 ? `Weekly ${on}` : `Every ${interval} weeks ${on}`;
    }
    // Familiar cadences keep their familiar names.
    if (unit === 'day' && interval === 1) return 'Daily';
    if (unit === 'week' && interval === 1) return 'Weekly';
    if (unit === 'week' && interval === 2) return 'Biweekly';
    if (unit === 'month' && interval === 1) return 'Monthly';
    return `Every ${interval} ${UNIT_LABELS[unit]}s`;
  }

  const legacy = g.recurrenceFrequency ? LEGACY_LABELS[g.recurrenceFrequency] : undefined;
  return legacy;
};

/** The same schedule as a sentence fragment, e.g. "Repeats every 3 days". */
export const recurrenceSentence = (g: RecurrenceFields | null | undefined): string | undefined => {
  const label = recurrenceLabel(g);
  if (!label) return undefined;
  // Weekday names have to keep their capitals: "repeats weekly on Mon & Fri".
  const [head, ...rest] = label.split(' on ');
  const tail = rest.length ? ` on ${rest.join(' on ')}` : '';
  return `Repeats ${head.toLowerCase()}${tail}`;
};
