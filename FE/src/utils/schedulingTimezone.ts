import type { HalfHourSlotIndex } from '../types/scheduling';
import type { BookingDisplayTimeZoneMode } from '../types/scheduling';

export const COMMON_IANA_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;

export function detectUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Offset from UTC in 30-minute units (positive = west of UTC, same sign as getTimezoneOffset/30 negated). */
export function getTimezoneOffsetHalfHours(timeZone: string, date: Date = new Date()): number {
  try {
    const utc = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
    );
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value) - 1;
    const d = Number(parts.find((p) => p.type === 'day')?.value);
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    const min = Number(parts.find((p) => p.type === 'minute')?.value);
    const tzMs = Date.UTC(y, m, d, h, min);
    return (utc - tzMs) / (30 * 60 * 1000);
  } catch {
    return -date.getTimezoneOffset() / 30;
  }
}

/** Civil YYYY-MM-DD from a calendar cell (the day number shown on the month grid). */
export function getViewerYmdFromCalendarDate(date: Date): string {
  return toYMDLocal(date);
}

/** UTC ms for midnight at the start of a calendar civil date in viewer TZ. */
export function getViewerDayStartMs(calendarDate: Date, viewerTz: string): number {
  const ymd = getViewerYmdFromCalendarDate(calendarDate);
  return zonedLocalToUtc(ymd, 0, 0, viewerTz).getTime();
}

/** Build a UTC Date for a wall-clock time on YYYY-MM-DD in an IANA timezone. */
export function zonedLocalToUtc(
  ymd: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d, hour, minute, 0, 0);
  for (let i = 0; i < 3; i++) {
    const offset = getTimezoneOffsetHalfHours(timeZone || 'UTC', new Date(guess));
    const refined = Date.UTC(y, m - 1, d, hour, minute, 0, 0) + offset * 30 * 60 * 1000;
    if (refined === guess) break;
    guess = refined;
  }
  return new Date(guess);
}

/** Half-hour slot index 0–47 for an instant in a given timezone (matches BE bookingValidation). */
export function getSlotIndexInTimeZone(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 2 + (minute >= 30 ? 1 : 0);
}

/** UTC instant for a viewer-local slot on a calendar day. */
export function viewerSlotToInstant(
  calendarDate: Date,
  slotIndex: number,
  viewerTz: string,
): Date {
  const ymd = getViewerYmdFromCalendarDate(calendarDate);
  const hour = Math.floor(slotIndex / 2);
  const minute = (slotIndex % 2) * 30;
  return zonedLocalToUtc(ymd, hour, minute, viewerTz);
}

/** Shift expert-local slot indices into the viewer's local day (DST-aware via date). */
export function convertExpertSlotsToViewer(
  expertSlots: HalfHourSlotIndex[],
  expertTz: string,
  viewerTz: string,
  date: Date = new Date(),
): HalfHourSlotIndex[] {
  if (!expertSlots?.length) return [];
  const expertOffset = getTimezoneOffsetHalfHours(expertTz || 'UTC', date);
  const viewerOffset = getTimezoneOffsetHalfHours(viewerTz || 'UTC', date);
  const shift = expertOffset - viewerOffset;
  const shifted = expertSlots.map((slot) => (slot + shift + 48) % 48);
  return [...new Set(shifted)].sort((a, b) => a - b);
}

/** Viewer-local slot indices for a calendar day, converted from expert recurring slots. */
export function getViewerSlotsForDay(
  calendarDate: Date,
  viewerTz: string,
  expertSlots: HalfHourSlotIndex[],
  expertTz: string,
): HalfHourSlotIndex[] {
  const ymd = getViewerYmdFromCalendarDate(calendarDate);
  const ref = zonedLocalToUtc(ymd, 12, 0, viewerTz);
  return convertExpertSlotsToViewer(expertSlots, expertTz, viewerTz, ref);
}

/** Three-letter weekday key ('Mon'…'Sun') for an instant, in the given timezone. */
export function expertWeekdayKey(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    weekday: 'short',
  }).format(instant);
}

/**
 * Pick the expert-local slot indices that apply to a given calendar day, honoring
 * weekday-specific availability. When the expert uses `availabilityMode === 'daily'`
 * and has `weeklyTimeSlots`, the slots for that day's expert-local weekday are used;
 * otherwise the flat recurring `timeSlots` apply to every day.
 */
export function getExpertSlotsForCalendarDay(
  expert: any,
  calendarDate: Date,
  viewerTz: string,
): HalfHourSlotIndex[] {
  const expertTz = expert?.timeZone || 'UTC';
  const weekly = expert?.weeklyTimeSlots;
  if (expert?.availabilityMode === 'daily' && weekly && typeof weekly === 'object') {
    const ymd = getViewerYmdFromCalendarDate(calendarDate);
    // Noon of the viewer's calendar day, used to read the expert-local weekday.
    const ref = zonedLocalToUtc(ymd, 12, 0, viewerTz);
    const key = expertWeekdayKey(ref, expertTz);
    const arr = weekly[key];
    return Array.isArray(arr) ? arr : [];
  }
  return Array.isArray(expert?.timeSlots) ? expert.timeSlots : [];
}

/** Viewer-local slot indices for a calendar day, weekday-aware (mode 'daily') when set. */
export function getViewerSlotsForExpertDay(
  expert: any,
  calendarDate: Date,
  viewerTz: string,
): HalfHourSlotIndex[] {
  const expertTz = expert?.timeZone || 'UTC';
  const expertSlots = getExpertSlotsForCalendarDay(expert, calendarDate, viewerTz);
  return getViewerSlotsForDay(calendarDate, viewerTz, expertSlots, expertTz);
}

/**
 * Whether a viewer-local slot on a calendar day falls inside the expert's per-date
 * blocked slots. The blocked map keys are expert-local YMD and values are expert-local
 * half-hour indices, so the viewer slot is mapped to its instant first, then to the
 * expert-local day + index. Tolerates a plain object or a Map.
 */
export function isViewerSlotBlockedOnDate(
  blockedSlotsMap: unknown,
  calendarDate: Date,
  viewerSlotIdx: number,
  viewerTz: string,
  expertTz: string,
): boolean {
  if (!blockedSlotsMap) return false;
  const instant = viewerSlotToInstant(calendarDate, viewerSlotIdx, viewerTz);
  const ymd = toYMDInTimeZone(instant, expertTz);
  const blocked =
    blockedSlotsMap instanceof Map
      ? (blockedSlotsMap.get(ymd) as number[] | undefined)
      : (blockedSlotsMap as Record<string, number[]>)[ymd];
  if (!Array.isArray(blocked) || !blocked.length) return false;
  return blocked.includes(getSlotIndexInTimeZone(instant, expertTz));
}

export function resolveViewerTimeZone(
  mode: BookingDisplayTimeZoneMode,
  studentTz: string,
  expertTz: string,
  customTz?: string,
): string {
  if (mode === 'expert') return expertTz || 'UTC';
  if (mode === 'custom' && customTz) return customTz;
  return studentTz || detectUserTimeZone();
}

export function formatSlotLabel(slotIndex: number, date: Date, timeZone: string): string {
  const instant = new Date(
    getViewerDayStartMs(date, timeZone) + slotIndex * 30 * 60 * 1000,
  );
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || 'UTC',
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}

export function formatBookingConfirmation(start: Date, end: Date, timeZone: string) {
  const tz = timeZone || 'UTC';
  const date = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(start);
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  });
  const timeRange = `${timeFmt.format(start)} – ${timeFmt.format(end)}`;
  return { date, timeRange, timeZone: tz };
}

export function formatPickedSlotWhenDisplay(start: Date, end: Date, timeZone: string): string {
  const { date, timeRange, timeZone: tz } = formatBookingConfirmation(start, end, timeZone);
  return `${date} · ${timeRange} (${tz})`;
}

export function toYMDLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Calendar day in a given IANA timezone (YYYY-MM-DD), aligned with server bookingValidation. */
export function toYMDInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
