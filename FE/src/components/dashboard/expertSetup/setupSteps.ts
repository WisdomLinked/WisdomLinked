import type { BookingNoticeHours, BufferMinutes, ExpertSchedulingFields } from '../../../types/scheduling';
import { normalizeAppointmentDurations } from '../../../utils/appointmentDurations';
import { BUFFER_MINUTES, normalizeBufferMinutes } from '../../../utils/availabilityDirty';
import { halfHourIndicesToHours, normalizeExpertPrice, WEEKDAY_KEYS } from '../../../utils/schedulingSlots';

export type ExpertAvailability = ExpertSchedulingFields;

export type SetupStepId = 'rate' | 'durations' | 'bookingRules' | 'timeSlots';

export interface SetupStep {
  id: SetupStepId;
  title: string;
  description: string;
  /** "inline" edits inside the card; "link" sends the expert to the Availability page. */
  mode: 'inline' | 'link';
  isComplete: (availability: ExpertAvailability) => boolean;
  getSummary: (availability: ExpertAvailability) => string;
}

export const MIN_HOURLY_RATE = 5;
export const RATE_PRESETS = [25, 50, 75, 100] as const;
export const BUFFER_OPTIONS: readonly BufferMinutes[] = BUFFER_MINUTES;
export const NOTICE_OPTIONS: readonly BookingNoticeHours[] = [24, 48, 72];

export const savedRate = (a: ExpertAvailability) => normalizeExpertPrice(a.price);

export const isValidRate = (rate: number | undefined): rate is number =>
  typeof rate === 'number' && Number.isFinite(rate) && rate >= MIN_HOURLY_RATE;

export const savedDurations = (a: ExpertAvailability) =>
  normalizeAppointmentDurations(a.appointmentDurations);

export const savedBuffer = (a: ExpertAvailability): BufferMinutes | null =>
  normalizeBufferMinutes(a.bufferMinutes);

export const savedNotice = (a: ExpertAvailability): BookingNoticeHours | null => {
  const n = Number(a.bookingNoticeHours);
  return (NOTICE_OPTIONS as readonly number[]).includes(n) ? (n as BookingNoticeHours) : null;
};

export const bufferLabel = (minutes: BufferMinutes) => (minutes === 0 ? 'None' : `${minutes} min`);

/** Saved weekly hours, read the same way the Availability page reads them for its mode. */
function savedSlotSummary(a: ExpertAvailability): { hoursPerDay: number; days: number; totalHours: number } {
  if (a.availabilityMode === 'daily') {
    const weekly = a.weeklyTimeSlots ?? {};
    const perDay = WEEKDAY_KEYS.map((day) => halfHourIndicesToHours(weekly[day] ?? []).length);
    const days = perDay.filter((h) => h > 0).length;
    const totalHours = perDay.reduce((sum, h) => sum + h, 0);
    return { hoursPerDay: 0, days, totalHours };
  }
  const hours = halfHourIndicesToHours(Array.isArray(a.timeSlots) ? a.timeSlots : []).length;
  return { hoursPerDay: hours, days: 7, totalHours: hours * 7 };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const SETUP_STEPS: SetupStep[] = [
  {
    id: 'rate',
    title: 'Hourly rate',
    description: 'Set what students pay per hour for a 1:1 session.',
    mode: 'inline',
    isComplete: (a) => isValidRate(savedRate(a)),
    getSummary: (a) => `$${savedRate(a)} per hour`,
  },
  {
    id: 'durations',
    title: 'Session lengths',
    description: 'Choose the session lengths students can book.',
    mode: 'inline',
    isComplete: (a) => savedDurations(a).length > 0,
    getSummary: (a) => savedDurations(a).map((d) => `${d} min`).join(', '),
  },
  {
    id: 'bookingRules',
    title: 'Booking rules',
    description: 'Pick a buffer between sessions and how much notice you need.',
    mode: 'inline',
    isComplete: (a) => savedBuffer(a) !== null && savedNotice(a) !== null,
    getSummary: (a) => {
      const buffer = savedBuffer(a);
      const bufferText = buffer === 0 ? 'No buffer' : `${buffer} min buffer`;
      return `${bufferText} · ${savedNotice(a)} hours notice`;
    },
  },
  {
    id: 'timeSlots',
    title: 'Weekly time slots',
    description: 'Mark the hours in your week when students can book you.',
    mode: 'link',
    isComplete: (a) => savedSlotSummary(a).totalHours > 0,
    getSummary: (a) => {
      const { hoursPerDay, days, totalHours } = savedSlotSummary(a);
      return a.availabilityMode === 'daily'
        ? `${plural(totalHours, 'hour')} a week across ${plural(days, 'day')}`
        : `${plural(hoursPerDay, 'hour')} per day`;
    },
  },
];
