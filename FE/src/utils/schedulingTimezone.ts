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

/** Shift expert-local slot indices into the viewer's local day. */
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

export function resolveViewerTimeZone(
  mode: BookingDisplayTimeZoneMode,
  studentTz: string,
  expertTz: string,
  customTz?: string,
): string {
  if (mode === 'expert') return expertTz || 'UTC';
  if (mode === 'custom' && customTz) return customTz;
  return detectUserTimeZone();
}

export function formatSlotLabel(slotIndex: number, date: Date, timeZone: string): string {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const instant = new Date(dayStart.getTime() + slotIndex * 30 * 60 * 1000);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || 'UTC',
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
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
