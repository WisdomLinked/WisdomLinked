// Decides whether a booking that grants access is actually backed by money.
// Pure so the admin report can be tested without Stripe or a database.

export type BookingChargeState = {
    /** Server-computed price of the booking, in cents. */
    priceCents: number;
    /** A charge row for this student+booking that reached 'completed'. */
    hasCompletedCharge: boolean;
    /** A charge row still mid-flight (written before capture). */
    hasPendingCharge: boolean;
    /** The charge was refunded but the student still holds the seat. */
    hasRefundedCharge: boolean;
    /** Funds are authorized and waiting on the expert's decision. */
    hasWithheldCharge: boolean;
};

export type BookingPaymentVerdict =
    | 'free'          // nothing was owed
    | 'paid'          // money captured and recorded
    | 'withheld'      // authorized, not captured, awaiting the expert's decision
    | 'in_flight'     // a capture is in progress; the sweep will settle it
    | 'refunded'      // paid then refunded, yet access remains — needs review
    | 'unpaid';       // access with no money behind it — the revenue-loss case

export function classifyBookingPayment(state: BookingChargeState): BookingPaymentVerdict {
    if (!(state.priceCents > 0)) return 'free';
    if (state.hasCompletedCharge) return 'paid';
    if (state.hasWithheldCharge) return 'withheld';
    if (state.hasPendingCharge) return 'in_flight';
    if (state.hasRefundedCharge) return 'refunded';
    return 'unpaid';
}

/** Verdicts an admin needs to act on, worst first. */
export const ACTIONABLE_VERDICTS: BookingPaymentVerdict[] = ['unpaid', 'refunded'];

export function isActionable(verdict: BookingPaymentVerdict): boolean {
    return ACTIONABLE_VERDICTS.includes(verdict);
}

export type SeatCheckInput = {
    type?: string;
    status?: string;
    /** Set while a proposed 1:1 is waiting for the student to pay. */
    paymentDeadline?: string | Date | null;
    priceCents: number;
    ownCharges?: Array<{ status?: string }>;
    /** A completed charge for this person exists on this session or another date in the same series. */
    seriesHasCompletedCharge?: boolean;
    /** The series payment that covered this date was refunded (it sits on another date). */
    seriesHasRefundedCharge?: boolean;
    sessionEnded?: boolean;
};

export type SeatCheck = {
    /** `waiting` is a proposed 1:1 that has not been paid yet. It is not a problem. */
    verdict: BookingPaymentVerdict | 'waiting';
    list: boolean;
};

/** Decide whether an enrolled person on a paid session belongs on the admin problem list. */
export function checkSeat(input: SeatCheckInput): SeatCheck {
    const folded = foldChargeRows(input.ownCharges || []);
    if (input.seriesHasCompletedCharge) folded.hasCompletedCharge = true;
    if (input.seriesHasRefundedCharge) folded.hasRefundedCharge = true;

    const noChargeYet = !folded.hasCompletedCharge
        && !folded.hasPendingCharge
        && !folded.hasWithheldCharge
        && !folded.hasRefundedCharge;
    const waitingForPayment = input.type === 'individual'
        && input.status === 'pending'
        && !!input.paymentDeadline
        && noChargeYet;
    if (waitingForPayment) return { verdict: 'waiting', list: false };

    const verdict = classifyBookingPayment({
        priceCents: input.priceCents,
        ...folded,
    });
    if (verdict === 'refunded' && input.sessionEnded) return { verdict, list: false };
    return { verdict, list: isActionable(verdict) };
}

/**
 * An admin refund adds a refund row and leaves the charge 'completed'. A completed charge
 * whose payment intent has any refund row is read as refunded, partial refunds included.
 */
export function markRefundedCharges<T extends { status?: string; paymentIntent?: string | null }>(
    rows: T[],
    refundedIntents: Set<string>,
): T[] {
    return (rows || []).map((row) => (
        row?.status === 'completed' && row.paymentIntent && refundedIntents.has(String(row.paymentIntent))
            ? { ...row, status: 'refunded' }
            : row
    ));
}

/** Over once its end has passed; without an end, once start + duration has. Undated is not over. */
export function sessionHasEnded(
    session: { start?: unknown; end?: unknown; duration?: unknown } | null | undefined,
    nowMs: number = Date.now(),
): boolean {
    const endMs = session?.end ? new Date(session.end as any).getTime() : NaN;
    if (Number.isFinite(endMs)) return endMs <= nowMs;
    const startMs = session?.start ? new Date(session.start as any).getTime() : NaN;
    if (!Number.isFinite(startMs)) return false;
    const minutes = Number(session?.duration);
    return startMs + (Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 0) <= nowMs;
}

export type IntegritySummary = Record<BookingPaymentVerdict, number>;

export function summarizeVerdicts(verdicts: BookingPaymentVerdict[]): IntegritySummary {
    const summary: IntegritySummary = { free: 0, paid: 0, withheld: 0, in_flight: 0, refunded: 0, unpaid: 0 };
    for (const verdict of verdicts) summary[verdict] += 1;
    return summary;
}

/** PaymentHistory statuses the admin report counts records for — one per clickable tile. */
export const RECORD_COUNT_STATUSES = ['completed', 'refunded', 'pending', 'withheld'] as const;

export type RecordCountStatus = (typeof RECORD_COUNT_STATUSES)[number];

/**
 * Turns a `$group by status` result into the per-status record totals. Counts every
 * PaymentHistory row with that status, so each total equals what the Payment History table
 * shows when filtered by that status alone.
 */
export function recordCountsByStatus(
    groups: Array<{ _id?: unknown; count?: unknown }>,
): Record<RecordCountStatus, number> {
    const counts: Record<RecordCountStatus, number> = { completed: 0, refunded: 0, pending: 0, withheld: 0 };
    for (const group of groups || []) {
        const status = String(group?._id ?? '') as RecordCountStatus;
        const count = Number(group?.count);
        if (!RECORD_COUNT_STATUSES.includes(status) || !Number.isFinite(count)) continue;
        counts[status] = count;
    }
    return counts;
}

/**
 * Reduces every charge row for one student+booking to the flags the classifier needs.
 * 'completed' wins over everything: a later partial-refund row must not make a genuinely
 * paid seat look unpaid.
 */
export function foldChargeRows(rows: Array<{ status?: string }>): Omit<BookingChargeState, 'priceCents'> {
    let hasCompletedCharge = false;
    let hasPendingCharge = false;
    let hasRefundedCharge = false;
    let hasWithheldCharge = false;
    for (const row of rows || []) {
        if (row?.status === 'completed') hasCompletedCharge = true;
        else if (row?.status === 'withheld') hasWithheldCharge = true;
        else if (row?.status === 'pending') hasPendingCharge = true;
        else if (row?.status === 'refunded') hasRefundedCharge = true;
    }
    return { hasCompletedCharge, hasPendingCharge, hasRefundedCharge, hasWithheldCharge };
}
