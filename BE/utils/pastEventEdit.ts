// A session that has already happened is a historical record: editing its time,
// price or capacity after the fact rewrites what students actually attended and
// paid for. The frontends hide their edit controls, but the rule has to live here
// too — the update endpoints are reachable directly.

// Fields whose value describes the session itself. Anything outside this set
// (bookkeeping like totalTimeSpent, which is written *after* a meeting ends by
// design) stays editable on a finished session.
const CONTENT_FIELDS = [
    'name',
    'description',
    'image',
    'services',
    'keywords',
    'customKeywords',
    'tags',
    'purposeOther',
    'start',
    'end',
    'duration',
    'price',
    'maxAttendees',
    'currency',
    'timezone',
    'isRecurring',
    'recurrenceFrequency',
    'recurrenceUnit',
    'recurrenceInterval',
    'recurrenceWeekdays',
    'recurrenceCount',
    'recurrenceUntil',
    'type',
    'status',
];

export const PAST_SEMINAR_EDIT_MESSAGE =
    'This seminar has already finished and can no longer be edited.';
export const PAST_SESSION_EDIT_MESSAGE =
    'This session has already finished and can no longer be edited.';

/** A booking is finished once its end time passes; sessions with no end fall back to start. */
export const bookingHasEnded = (booking: any, now: number = Date.now()): boolean => {
    const boundary = booking?.end || booking?.start;
    if (!boundary) return false;
    const ts = new Date(boundary).getTime();
    return Number.isFinite(ts) && ts < now;
};

/**
 * Returns an error message when the update should be rejected, or null when it
 * may proceed. Community rooms have no schedule, so they are never "past".
 */
export const describePastEditRejection = (
    booking: any,
    updateFields: Record<string, any>,
    now: number = Date.now(),
): string | null => {
    if (!booking || booking.type === 'community') return null;
    if (!bookingHasEnded(booking, now)) return null;
    const touchesContent = CONTENT_FIELDS.some((field) =>
        Object.prototype.hasOwnProperty.call(updateFields || {}, field),
    );
    if (!touchesContent) return null;
    return booking.type === 'seminar' ? PAST_SEMINAR_EDIT_MESSAGE : PAST_SESSION_EDIT_MESSAGE;
};

/** Throws with a user-facing message when a finished booking is being edited. */
export const assertGroupChatEditable = (
    booking: any,
    updateFields: Record<string, any>,
    now: number = Date.now(),
): void => {
    const rejection = describePastEditRejection(booking, updateFields, now);
    if (rejection) {
        const err: any = new Error(rejection);
        err.statusCode = 409;
        throw err;
    }
};
