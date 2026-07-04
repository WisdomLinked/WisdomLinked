import {
  getExpertSlotsForCalendarDay,
  getSlotIndexInTimeZone,
  toYMDInTimeZone,
} from './schedulingTimezone';

const HALF_HOUR_MS = 30 * 60 * 1000;

function slotBoundaryLabel(index: number): string {
  const hour = Math.floor(index / 2);
  const minute = (index % 2) * 30;
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Expert-local half-hour slot indices the expert has marked available on the given YYYY-MM-DD. */
export function presetSlotIndicesForDate(expert: any, dateStr: string): number[] {
  if (!dateStr) return [];
  const dayDate = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(dayDate.getTime())) return [];
  const tz = expert?.timeZone || 'UTC';
  const slots = getExpertSlotsForCalendarDay(expert, dayDate, tz);
  return Array.isArray(slots) ? [...slots].sort((a, b) => a - b) : [];
}

/** Human-readable contiguous availability ranges (e.g. "9:00 AM – 12:00 PM") for a date. */
export function presetAvailabilityRanges(expert: any, dateStr: string): string[] {
  const slots = presetSlotIndicesForDate(expert, dateStr);
  if (!slots.length) return [];
  const ranges: string[] = [];
  let runStart = slots[0];
  let prev = slots[0];
  for (let i = 1; i < slots.length; i++) {
    if (slots[i] === prev + 1) {
      prev = slots[i];
      continue;
    }
    ranges.push(`${slotBoundaryLabel(runStart)} – ${slotBoundaryLabel(prev + 1)}`);
    runStart = slots[i];
    prev = slots[i];
  }
  ranges.push(`${slotBoundaryLabel(runStart)} – ${slotBoundaryLabel(prev + 1)}`);
  return ranges;
}

/** Whether [start, end) falls entirely inside the expert's preset availability window for that day. */
export function isRangeWithinPreset(expert: any, start: Date, end: Date): boolean {
  const tz = expert?.timeZone || 'UTC';
  const daySlots = getExpertSlotsForCalendarDay(expert, start, tz);
  const set = new Set(Array.isArray(daySlots) ? daySlots : []);
  if (!set.size) return false;
  for (let t = start.getTime(); t < end.getTime(); t += HALF_HOUR_MS) {
    if (!set.has(getSlotIndexInTimeZone(new Date(t), tz))) return false;
  }
  return true;
}

function isDateBlocked(expert: any, start: Date): boolean {
  const blocked = expert?.blockedBookingDates;
  if (!Array.isArray(blocked) || !blocked.length) return false;
  return blocked.includes(toYMDInTimeZone(start, expert?.timeZone || 'UTC'));
}

function isAnySlotBlocked(expert: any, start: Date, end: Date): boolean {
  const map = expert?.blockedBookingSlots;
  if (!map) return false;
  const tz = expert?.timeZone || 'UTC';
  for (let t = start.getTime(); t < end.getTime(); t += HALF_HOUR_MS) {
    const d = new Date(t);
    const ymd = toYMDInTimeZone(d, tz);
    const arr = map instanceof Map ? map.get(ymd) : (map as Record<string, number[]>)[ymd];
    if (Array.isArray(arr) && arr.includes(getSlotIndexInTimeZone(d, tz))) return true;
  }
  return false;
}

/**
 * Whether the proposed time falls outside the expert's own stated availability for any
 * reason they can knowingly override: outside the preset window, on a blocked day, or
 * over a blocked slot. (Real double-booking conflicts are enforced server-side regardless.)
 */
export function proposedTimeNeedsOverride(expert: any, start: Date, end: Date): boolean {
  return (
    !isRangeWithinPreset(expert, start, end) ||
    isDateBlocked(expert, start) ||
    isAnySlotBlocked(expert, start, end)
  );
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Whether [start, end) collides with a session the expert already has (a 1:1 or seminar that
 * is pending/active, or a legacy event that isn't declined). Mirrors the server-side overlap
 * guard — a real double-booking is NOT overridable, so the UI should block it outright.
 */
export function hasBookingConflict(expert: any, start: Date, end: Date): boolean {
  const s = start.getTime();
  const e = end.getTime();

  const events = Array.isArray(expert?.events) ? expert.events : [];
  for (const ev of events) {
    if (ev?.status === 'declined') continue;
    if (rangesOverlap(s, e, new Date(ev?.start).getTime(), new Date(ev?.end).getTime())) return true;
  }

  const chats = Array.isArray(expert?.groupChats) ? expert.groupChats : [];
  for (const c of chats) {
    if (c?.status !== 'pending' && c?.status !== 'active') continue;
    if (rangesOverlap(s, e, new Date(c?.start).getTime(), new Date(c?.end).getTime())) return true;
  }

  return false;
}
