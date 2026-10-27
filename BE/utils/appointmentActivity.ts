/**
 * Call time against booked time for one 1:1 appointment, plus how much the two
 * kept talking after it, for the admin audit view. Pure: callers pass the
 * appointment, its meetings and its Rocket.Chat history.
 */
import { isCountableMessage } from './communityActivity';

/** A meeting nobody ends is closed after this long (see meeting.controller). */
export const MEETING_MAX_ACTIVE_MS = Math.max(
    30 * 60 * 1000,
    Number(process.env.MEETING_MAX_ACTIVE_HOURS || 12) * 60 * 60 * 1000,
);

export type AppointmentTimeStatus = 'recorded' | 'unconfirmed' | 'in-progress' | 'no-call';

export type AppointmentSummary = {
    bookedMinutes: number | null;
    calledMinutes: number;
    timeStatus: AppointmentTimeStatus;
    callsDuring: number;
    callsAfter: number;
    /** null when the chat history could not be read. */
    messagesAfter: number | null;
    scheduledEnd: string | null;
};

const toMs = (value: unknown): number | null => {
    if (value == null) return null;
    const raw = (value as any)?.$date ?? value;
    const ms = new Date(raw as any).getTime();
    return Number.isFinite(ms) ? ms : null;
};

/**
 * The site closed this call itself, so its end time is not when people left.
 * Older records have no flag; they are recognised by lasting the full limit.
 */
export function isAutoClosedMeeting(meeting: any, maxActiveMs: number = MEETING_MAX_ACTIVE_MS): boolean {
    if (meeting?.autoClosed) return true;
    if (meeting?.status !== 'ended') return false;
    const seconds = Number(meeting?.duration);
    return Number.isFinite(seconds) && seconds * 1000 >= maxActiveMs - 60_000;
}

export function appointmentSummary({
    appointment,
    meetings,
    messages,
    maxActiveMs = MEETING_MAX_ACTIVE_MS,
}: {
    appointment: { start?: unknown; end?: unknown; duration?: unknown };
    meetings: any[];
    messages: any[] | null;
    maxActiveMs?: number;
}): AppointmentSummary {
    const startMs = toMs(appointment?.start);
    const bookedFromField = Number(appointment?.duration);
    const endMs =
        toMs(appointment?.end) ??
        (startMs != null && Number.isFinite(bookedFromField) ? startMs + bookedFromField * 60_000 : null);
    const bookedMinutes = Number.isFinite(bookedFromField) && bookedFromField > 0
        ? bookedFromField
        : startMs != null && endMs != null && endMs > startMs
          ? Math.round((endMs - startMs) / 60_000)
          : null;

    const isAfter = (meeting: any) => {
        const started = toMs(meeting?.startedAt);
        return endMs != null && started != null && started >= endMs;
    };
    const during = (meetings || []).filter(meeting => !isAfter(meeting));
    const after = (meetings || []).filter(isAfter);

    let reliableSeconds = 0;
    let unconfirmed = false;
    let ongoing = false;
    for (const meeting of during) {
        if (meeting?.status === 'active') ongoing = true;
        else if (isAutoClosedMeeting(meeting, maxActiveMs)) unconfirmed = true;
        else reliableSeconds += Math.max(0, Number(meeting?.duration) || 0);
    }
    const timeStatus: AppointmentTimeStatus = !during.length
        ? 'no-call'
        : ongoing
          ? 'in-progress'
          : unconfirmed
            ? 'unconfirmed'
            : 'recorded';

    let messagesAfter: number | null = null;
    if (messages) {
        messagesAfter = endMs == null
            ? 0
            : messages.filter(message => {
                const sent = toMs(message?.ts);
                return isCountableMessage(message) && sent != null && sent >= endMs;
            }).length;
    }

    return {
        bookedMinutes,
        calledMinutes: Math.round(reliableSeconds / 60),
        timeStatus,
        callsDuring: during.length,
        callsAfter: after.length,
        messagesAfter,
        scheduledEnd: endMs != null ? new Date(endMs).toISOString() : null,
    };
}
