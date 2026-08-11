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
