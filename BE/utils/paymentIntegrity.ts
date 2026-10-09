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
