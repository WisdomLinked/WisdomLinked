const normalizeSeminarId = (v: any): string => String(v?._id ?? v?.id ?? v ?? "").trim();

// Enrolled students = participants minus the host (the admin is always a
// participant of their own seminar).
export const enrolledStudentIds = (groupChat: any): string[] => {
    const adminId = normalizeSeminarId(groupChat?.admin);
    return (Array.isArray(groupChat?.participants) ? groupChat.participants : [])
        .map((p: any) => normalizeSeminarId(p))
        .filter((id: string) => id && id !== adminId);
};

// Capacity is unlimited only when maxAttendees is unset (null/undefined). A
// numeric cap of 0 (or negative) means the seminar is closed — no seats — not
// unlimited, so a host who types 0 to stop registration gets what they expect.
export const hasCapacityLimit = (maxAttendees: unknown): boolean =>
    typeof maxAttendees === 'number';

// A seminar is full once it has a capacity limit and enrolment has reached it.
// A cap of 0 or less is always full.
export const seminarIsFull = (groupChat: any): boolean => {
    const cap = typeof groupChat?.maxAttendees === 'number' ? groupChat.maxAttendees : null;
    if (cap == null) return false;
    if (cap <= 0) return true;
    return enrolledStudentIds(groupChat).length >= cap;
};

// Given a list of seminar occurrences, returns the first that is both still in the
// future and at capacity, or null when every future occurrence has room. Used to
// stop a student joining a recurring series when a later session can't seat them.
export const firstFullFutureOccurrence = (occurrences: any[], nowMs: number = Date.now()): any | null => {
    for (const occ of Array.isArray(occurrences) ? occurrences : []) {
        const startMs = occ?.start ? new Date(occ.start).getTime() : 0;
        if (startMs >= nowMs && seminarIsFull(occ)) return occ;
    }
    return null;
};

// Why an overflow seat request can no longer be approved, or null when it still can.
// The hold was authorized when the request was made; by approval time the seminar may
// have been re-priced, cancelled, started, the request expired, or the student already
// enrolled another way. Approval must recheck all of these before capturing money.
export type SeatApprovalBlock =
    | 'already_enrolled'
    | 'seminar_closed'
    | 'seminar_started'
    | 'request_expired'
    | 'price_increased'
    | null;

export const resolveSeatApprovalBlock = (input: {
    alreadyEnrolled: boolean;
    seminarStatus: string;
    startMs: number;
    deadlineMs: number;
    authorizedCents?: number;
    currentPriceCents?: number;
    nowMs?: number;
}): SeatApprovalBlock => {
    const now = typeof input.nowMs === 'number' ? input.nowMs : Date.now();
    if (input.alreadyEnrolled) return 'already_enrolled';
    if (input.seminarStatus !== 'active') return 'seminar_closed';
    if (!(input.startMs > now)) return 'seminar_started';
    if (input.deadlineMs && input.deadlineMs <= now) return 'request_expired';
    // The hold can only capture up to the authorized amount. If the host raised the
    // price after the request, capturing the old (lower) amount would undercharge, so
    // block and make the student re-request at the new price. A price drop is fine —
    // the approval captures the lower current price.
    if (
        typeof input.authorizedCents === 'number' &&
        typeof input.currentPriceCents === 'number' &&
        input.currentPriceCents > input.authorizedCents
    ) {
        return 'price_increased';
    }
    return null;
};

export const SEAT_REQUEST_HOLD_MS = 7 * 24 * 60 * 60 * 1000;

// Overflow seat requests hold funds via Stripe (auth expires after ~7 days), and
// the host should ideally decide an admin-set number of hours before the seminar
// starts. When the seminar is too close for that full buffer, the deadline falls
// back to the seminar start (the host can decide right up until it begins) so a
// freshly-created request is never already past its deadline. Capped by the hold
// expiry, and never returned in the past.
export const computeSeatRequestDeadline = (
    startMs: number,
    deadlineHours: number,
    nowMs: number = Date.now(),
): Date => {
    const deadlineByStart = startMs - deadlineHours * 60 * 60 * 1000;
    const holdExpiry = nowMs + SEAT_REQUEST_HOLD_MS;
    const effective = deadlineByStart > nowMs ? deadlineByStart : startMs;
    return new Date(Math.min(effective, holdExpiry));
};

// A full seminar only accepts seat requests while it's inside the hold window
// (future, but no more than ~7 days out).
export const seatRequestWindowOpen = (startMs: number, nowMs: number = Date.now()): boolean =>
    startMs > nowMs && startMs <= nowMs + SEAT_REQUEST_HOLD_MS;

// The moment the waiting list opens for a full seminar: a Stripe auth only lives
// ~7 days, so requests can't be taken (and money can't be held) before then.
export const seatRequestWindowOpensAt = (startMs: number): number => startMs - SEAT_REQUEST_HOLD_MS;

export type SeatRequestWindowState = 'open' | 'too_early' | 'closed' | 'undated';

export const seatRequestWindowState = (
    startMs: number,
    nowMs: number = Date.now(),
): SeatRequestWindowState => {
    if (!Number.isFinite(startMs) || startMs <= 0) return 'undated';
    if (startMs <= nowMs) return 'closed';
    return startMs <= nowMs + SEAT_REQUEST_HOLD_MS ? 'open' : 'too_early';
};

const formatOpensAt = (ms: number): string =>
    new Date(ms).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });

// Why a full seminar can't take a waiting-list request right now. Null when it can.
// The date is the one the student is told to come back after, so it must be the same
// boundary the guard uses.
export const seatRequestUnavailableMessage = (
    startMs: number,
    nowMs: number = Date.now(),
): string | null => {
    switch (seatRequestWindowState(startMs, nowMs)) {
        case 'open':
            return null;
        case 'too_early':
            return `This seminar is full. After ${formatOpensAt(seatRequestWindowOpensAt(startMs))}, check for seat availability again — the waiting list opens 7 days before the seminar starts.`;
        case 'closed':
            return 'This seminar is full and has already started, so the waiting list is closed.';
        default:
            return 'This seminar is full. The waiting list opens once the host sets a start date.';
    }
};
