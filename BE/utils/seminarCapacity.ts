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

/**
 * Occupied seats = enrolled students + soft holds (awaiting_payment offers/invites).
 * Soft holds reserve capacity until the student pays or the offer expires.
 */
export const occupiedSeminarSeats = (
    groupChat: any,
    softHeldCount: number = 0,
): number => enrolledStudentIds(groupChat).length + Math.max(0, Number(softHeldCount) || 0);

/**
 * Effective enrollment cap for an atomic participant claim after soft holds are reserved.
 * Returns null when unlimited; 0 when closed or fully soft-held.
 */
export const claimableSeatCap = (
    maxAttendees: unknown,
    softHeldCount: number = 0,
): number | null => {
    if (typeof maxAttendees !== 'number') return null;
    if (maxAttendees <= 0) return 0;
    return Math.max(0, maxAttendees - Math.max(0, Number(softHeldCount) || 0));
};

// A seminar is full once it has a capacity limit and occupied seats (enrolled +
// soft-held awaiting_payment offers) have reached it. A cap of 0 or less is always full.
export const seminarIsFull = (groupChat: any, softHeldCount: number = 0): boolean => {
    const cap = typeof groupChat?.maxAttendees === 'number' ? groupChat.maxAttendees : null;
    if (cap == null) return false;
    if (cap <= 0) return true;
    return occupiedSeminarSeats(groupChat, softHeldCount) >= cap;
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

// Interest waitlist: join anytime while the seminar is still in the future.
// (Legacy Stripe-hold code still uses SEAT_REQUEST_HOLD_MS for decision deadlines.)
export const seatRequestWindowOpen = (startMs: number, nowMs: number = Date.now()): boolean =>
    Number.isFinite(startMs) && startMs > nowMs;

// Kept for legacy callers/tests that still reason about the old 7-day hold boundary.
export const seatRequestWindowOpensAt = (startMs: number): number => startMs - SEAT_REQUEST_HOLD_MS;

export type SeatRequestWindowState = 'open' | 'too_early' | 'closed' | 'undated';

export const seatRequestWindowState = (
    startMs: number,
    nowMs: number = Date.now(),
): SeatRequestWindowState => {
    if (!Number.isFinite(startMs) || startMs <= 0) return 'undated';
    if (startMs <= nowMs) return 'closed';
    // Interest waitlist no longer waits for the 7-day hold window — future = open.
    return 'open';
};

/** Why a full seminar can't take a waitlist join right now. Null when it can. */
export const seatRequestUnavailableMessage = (
    startMs: number,
    nowMs: number = Date.now(),
): string | null => {
    switch (seatRequestWindowState(startMs, nowMs)) {
        case 'open':
        case 'too_early':
            return null;
        case 'closed':
            return 'This seminar is full and has already started, so the waiting list is closed.';
        default:
            // Undated but still listed as full — allow interest join.
            return null;
    }
};

/** Legacy card/wallet holds that still need host approve+capture until drained. */
export const isLegacyHeldSeatRequest = (request: {
    paymentIntent?: string | null;
    paymentMode?: string | null;
    amount?: number | null;
}): boolean => {
    if (request?.paymentIntent) return true;
    if (String(request?.paymentMode || '') === 'wallet' && Number(request?.amount) > 0) return true;
    return false;
};
