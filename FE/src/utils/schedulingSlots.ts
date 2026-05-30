import type { HalfHourSlotIndex } from '../types/scheduling';

/** Map UI hour pills (0–23) to backend half-hour indices (0–47). */
export function hoursToHalfHourIndices(hours: number[]): HalfHourSlotIndex[] {
  const indices = new Set<number>();
  for (const h of hours) {
    if (h < 0 || h > 23) continue;
    indices.add(h * 2);
    indices.add(h * 2 + 1);
  }
  return [...indices].sort((a, b) => a - b);
}

/** Derive selected hours from stored half-hour indices. */
export function halfHourIndicesToHours(indices: HalfHourSlotIndex[]): number[] {
  const hours = new Set<number>();
  for (const idx of indices) {
    if (idx >= 0 && idx <= 47) {
      hours.add(Math.floor(idx / 2));
    }
  }
  return [...hours].sort((a, b) => a - b);
}

/** Union hours from daily availability rows (weekly model stores one combined list). */
export function unionDailyAvailabilityHours(
  daily: Array<{ enabled: boolean; selectedSlots: number[] }>,
): number[] {
  const hours = new Set<number>();
  for (const row of daily) {
    if (!row.enabled) continue;
    row.selectedSlots.forEach((h) => hours.add(h));
  }
  return [...hours].sort((a, b) => a - b);
}

export function normalizeExpertPrice(price: unknown): number | undefined {
  if (typeof price === 'number' && !Number.isNaN(price)) return price;
  if (Array.isArray(price) && price.length > 0) {
    const n = Number(price[0]);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

/** Keep only start slots that have enough consecutive 30-min blocks for the session length. */
export function filterSlotsForDuration(
  slots: HalfHourSlotIndex[],
  durationMinutes: number,
): HalfHourSlotIndex[] {
  if (durationMinutes <= 30) return slots;
  const blocks = durationMinutes / 30;
  const slotSet = new Set(slots);
  return slots.filter((slotIdx) =>
    Array.from({ length: blocks }, (_, i) => slotIdx + i).every((s) => slotSet.has(s)),
  );
}

function timePartsForHour(hour: number): {
  displayHour: number;
  period: 'AM' | 'PM';
} {
  const h = ((hour % 24) + 24) % 24;
  const period: 'AM' | 'PM' = h < 12 ? 'AM' : 'PM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return { displayHour, period };
}

function formatTimeWithMinutes(
  hour: number,
  minute: number,
): { label: string; period: 'AM' | 'PM' } {
  const { displayHour, period } = timePartsForHour(hour);
  return { label: `${displayHour}:${String(minute).padStart(2, '0')}`, period };
}

function formatHalfRange(
  startH: number,
  startM: number,
  endH: number,
  endM: number,
): string {
  const start = formatTimeWithMinutes(startH, startM);
  const end = formatTimeWithMinutes(endH, endM);
  if (start.period === end.period) {
    return `${start.label}\u2013${end.label} ${start.period}`;
  }
  return `${start.label} ${start.period}\u2013${end.label} ${end.period}`;
}

function formatShortHour(hour: number): string {
  const { displayHour, period } = timePartsForHour(hour);
  return `${displayHour} ${period}`;
}

/**
 * Render a 1-hour availability window as "8:00 AM\u20139:00 AM" / "11:00 PM\u201312:00 AM".
 * Both sides always show their AM/PM marker so the meaning is unambiguous in the pill.
 */
export function formatHourRange(hour: number): string {
  const start = timePartsForHour(hour);
  const end = timePartsForHour(hour + 1);
  return `${start.displayHour}:00 ${start.period}\u2013${end.displayHour}:00 ${end.period}`;
}

/**
 * Describe how an hour pill breaks down for a given session length.
 * Returns empty string when the hour IS the bookable interval (60 min).
 */
export function formatSubIntervals(hour: number, durationMin: number): string {
  if (durationMin === 60) return '';
  if (durationMin === 30) {
    const startPart = timePartsForHour(hour);
    const endPart = timePartsForHour(hour + 1);
    if (startPart.period === endPart.period) {
      return `${startPart.displayHour}:00\u2013${startPart.displayHour}:30 \u00b7 ${startPart.displayHour}:30\u2013${endPart.displayHour}:00 ${startPart.period}`;
    }
    return `${formatHalfRange(hour, 0, hour, 30)} \u00b7 ${formatHalfRange(hour, 30, hour + 1, 0)}`;
  }
  if (durationMin === 90) {
    return `90 min \u00b7 spans into ${formatShortHour(hour + 1)}`;
  }
  return '';
}
