/**
 * Which session reminders are due right now.
 *
 * Pure and DB-free so the timing rules can be proven without Mongo or SendGrid.
 * The sweeper (services/sessionReminderSweep.ts) supplies `now` and the session
 * fields; everything about *when* a reminder should fire is decided here.
 *
 * Why a sweeper at all: the old path asked SendGrid to hold the mail via `sendAt`,
 * and SendGrid refuses anything more than 72h out. Most bookings are further away,
 * so most reminders never sent. Deciding "is it due yet?" on our side removes that
 * limit entirely, and makes cancellations and reschedules fall out for free.
 */

export type ReminderKind = '24h' | '15m';

/** Lead time each reminder is named after. */
export const REMINDER_LEAD_MS: Record<ReminderKind, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '15m': 15 * 60 * 1000,
};

/** Longest lead time — the sweeper only needs to look this far ahead. */
export const MAX_REMINDER_LEAD_MS = REMINDER_LEAD_MS['24h'];

/**
 * A session booked this close to its own start never gets a reminder: the mail
 * would land on top of the session, or after it. Confirmed with Vasanth 2026-09-13.
 */
export const LATE_BOOKING_CUTOFF_MS = REMINDER_LEAD_MS['15m'];

/**
 * How long after its mark a reminder may still be sent, per kind.
 *
 * These differ because the copy ages differently. "Your session is tomorrow" is
 * still true hours after the 24h mark, so an outage should catch up rather than
 * skip. "Starting in about 15 minutes" stops being true almost immediately, so a
 * late one is worse than none — past this we stay quiet and let the session begin.
 */
export const REMINDER_STALE_AFTER_MS: Record<ReminderKind, number> = {
    '24h': 6 * 60 * 60 * 1000,
    '15m': 5 * 60 * 1000,
};

const toMs = (value: any): number => {
    if (value === null || value === undefined || value === '') return NaN;
    const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(ms) ? ms : NaN;
};

/**
 * True when the session was created so close to its start that reminding is pointless.
 * A missing createdAt is treated as *not* late — absence of evidence is not evidence
 * of a late booking, and staying silent would be the worse failure.
 */
export const isLateBooking = (
    start: any,
    createdAt: any,
    cutoffMs: number = LATE_BOOKING_CUTOFF_MS,
): boolean => {
    const startMs = toMs(start);
    const createdMs = toMs(createdAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(createdMs)) return false;
    return createdMs > startMs - cutoffMs;
};

/**
 * The reminders a single session should send on this tick.
 *
 * A reminder is due once its mark has *passed* and we have not sent it yet — not
 * at the exact instant of the mark, which a periodic job would always miss. That
 * also means a restart catches up instead of silently skipping.
 *
 * Returns kinds in send order, oldest mark first.
 */
export const dueReminders = ({
    start,
    createdAt,
    alreadySent = [],
    now = Date.now(),
    staleAfterMs = REMINDER_STALE_AFTER_MS,
}: {
    start: any;
    createdAt?: any;
    alreadySent?: readonly string[] | null;
    now?: number;
    staleAfterMs?: Record<ReminderKind, number>;
}): ReminderKind[] => {
    const startMs = toMs(start);
    if (!Number.isFinite(startMs)) return [];

    // Nothing to remind anyone about once the session has begun.
    if (startMs <= now) return [];

    if (isLateBooking(start, createdAt)) return [];

    const sent = new Set((alreadySent || []).map((k) => String(k)));

    return (['24h', '15m'] as ReminderKind[]).filter((kind) => {
        if (sent.has(kind)) return false;
        const markMs = startMs - REMINDER_LEAD_MS[kind];
        if (markMs > now) return false;                    // mark not reached yet
        return now - markMs <= staleAfterMs[kind];         // ...and not so long ago it is stale
    });
};

/**
 * The window the sweeper should query: sessions starting between now and the
 * furthest mark. Anything outside it cannot have a reminder due on this tick.
 */
export const reminderQueryWindow = (now: number = Date.now()): { from: Date; to: Date } => ({
    from: new Date(now),
    to: new Date(now + MAX_REMINDER_LEAD_MS),
});
