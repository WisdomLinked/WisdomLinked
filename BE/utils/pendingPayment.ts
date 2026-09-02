export type PendingPaymentAction = 'settle' | 'fail' | 'wait' | 'refund' | 'release';

export type PendingPaymentState = {
    captured: boolean;
    stillAuthorized: boolean;
    ownedByOpenSeatRequest: boolean;
    enrolled: boolean;
    /** Wallet payment Stripe is still clearing (PaymentIntent status `processing`). */
    settling?: boolean;
};

export function resolvePendingPayment(state: PendingPaymentState): PendingPaymentAction {
    if (state.ownedByOpenSeatRequest) return 'wait';
    if (state.captured) return state.enrolled ? 'settle' : 'refund';
    // Money on its way from a wallet can be neither released nor refunded, and failing
    // the row would write off a payment that is about to land. Wait for the webhook.
    if (state.settling) return 'wait';
    if (state.stillAuthorized) return 'release';
    return 'fail';
}

// A booking PaymentIntent read straight from Stripe during orphan reconciliation.
export type OrphanedIntentState = {
    status: string;          // Stripe PaymentIntent status
    recorded: boolean;       // a PaymentHistory row already references this intent
    heldByRequest: boolean;  // an open (pending/approved) seat request owns it
    enrolled: boolean;       // the student is a participant of the target seminar
};

export type OrphanedIntentAction = 'skip' | 'release' | 'record' | 'refund';

// Decides what to do with a booking intent that has no local PaymentHistory row.
// 'skip'  — already accounted for, or owned by the approval flow; leave it alone.
// 'release' — funds are only held; cancel the authorization (student never charged).
// 'record'  — captured and the student is genuinely enrolled; record the earned charge.
// 'refund'  — captured but the booking never completed; return the money.
export function resolveOrphanedIntent(state: OrphanedIntentState): OrphanedIntentAction {
    if (state.recorded || state.heldByRequest) return 'skip';
    if (state.status === 'requires_capture') return 'release';
    if (state.status === 'succeeded') return state.enrolled ? 'record' : 'refund';
    return 'skip';
}
