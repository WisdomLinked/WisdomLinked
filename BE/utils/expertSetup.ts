import { normalizeExpertPrice } from './normalizeExpertPrice';
const { normalizeAppointmentDurations } = require('./appointmentDurations');

const MIN_HOURLY_RATE = 5;
const BUFFER_OPTIONS = [0, 15, 30];
const NOTICE_OPTIONS = [24, 48, 72];
const WEEKDAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const EXPERT_SETUP_INCOMPLETE_FOR_STUDENT =
    "This expert hasn't completed their profile setup yet, so they can't take bookings right now.";
export const EXPERT_SETUP_INCOMPLETE_FOR_EXPERT =
    "You need to complete your profile setup first.";

export const NEW_EXPERT_PENDING_SETUP_STEPS = ['rate', 'durations', 'notice'];

const isPending = (user: any, step: string) =>
    Array.isArray(user?.pendingSetupSteps) && user.pendingSetupSteps.includes(step);

const toNumber = (raw: unknown) => (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw);

const bookableHourCount = (indices: unknown): number => {
    const hours = new Set<number>();
    for (const idx of Array.isArray(indices) ? indices : []) {
        const n = Number(idx);
        if (n >= 0 && n <= 47) hours.add(Math.floor(n / 2));
    }
    return hours.size;
};

const weeklySlot = (weekly: any, day: string) =>
    typeof weekly?.get === 'function' ? weekly.get(day) : weekly?.[day];

const hasWeeklyHours = (user: any): boolean => {
    if (user?.availabilityMode === 'daily') {
        return WEEKDAY_KEYS.some((day) => bookableHourCount(weeklySlot(user?.weeklyTimeSlots, day)) > 0);
    }
    return bookableHourCount(user?.timeSlots) > 0;
};

export function isExpertSetupComplete(user: any): boolean {
    if (!user) return false;
    const rate = normalizeExpertPrice(user.price);
    const rateDone = !isPending(user, 'rate') && typeof rate === 'number' && Number.isFinite(rate) && rate >= MIN_HOURLY_RATE;
    const durationsDone = !isPending(user, 'durations') && normalizeAppointmentDurations(user.appointmentDurations).length > 0;
    const rulesDone =
        BUFFER_OPTIONS.includes(toNumber(user.bufferMinutes) as number) &&
        !isPending(user, 'notice') &&
        NOTICE_OPTIONS.includes(Number(user.bookingNoticeHours));
    return rateDone && durationsDone && rulesDone && hasWeeklyHours(user);
}
