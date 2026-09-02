export const DECISION_NOTICE_TTL_MS = 48 * 60 * 60 * 1000;

export type DecisionNoticeState = {
    note?: string;
    decidedAt?: unknown;
    readAt?: unknown;
};

const msOf = (value: unknown): number | null => {
    if (!value) return null;
    const ts = new Date(value as any).getTime();
    return Number.isFinite(ts) ? ts : null;
};

export const decisionNoticeIsVisible = (
    state: DecisionNoticeState,
    now: number = Date.now(),
): boolean => {
    if (!state?.note || !String(state.note).trim()) return false;
    if (msOf(state.readAt) !== null) return false;
    const decided = msOf(state.decidedAt);
    if (decided === null) return false;
    return now - decided < DECISION_NOTICE_TTL_MS;
};

/** The instant a notice stops being shown, for the UI countdown. */
export const decisionNoticeExpiresAt = (state: DecisionNoticeState): number | null => {
    const decided = msOf(state?.decidedAt);
    return decided === null ? null : decided + DECISION_NOTICE_TTL_MS;
};

/** Only rows still inside the window need fetching — the cutoff for the DB query. */
export const decisionNoticeCutoff = (now: number = Date.now()): Date =>
    new Date(now - DECISION_NOTICE_TTL_MS);

export type DecisionOutcome = 'accepted' | 'accepted_awaiting_payment' | 'declined' | 'withdrawn';

// What the expert's note actually means for the student. A wallet booking splits the
// old single event in two: the expert says yes, and the booking is confirmed later when
// the student pays. Reading "not yet confirmed" as "declined" tells them the opposite of
// what happened, so the in-between state is named rather than lumped in with a refusal.
export const resolveSessionDecisionOutcome = (input: {
    status: string;
    expertCreated: boolean;
    awaitingPayment?: boolean;
}): DecisionOutcome => {
    if (input.status === 'active') return 'accepted';
    if (input.status !== 'cancelled' && input.awaitingPayment) return 'accepted_awaiting_payment';
    return input.expertCreated ? 'withdrawn' : 'declined';
};

export const resolveSeatDecisionOutcome = (status: string): DecisionOutcome => {
    if (status === 'approved') return 'accepted';
    if (status === 'awaiting_payment') return 'accepted_awaiting_payment';
    return 'declined';
};
