/**
 * A wallet booking splits what used to be one event in two: the expert accepts, and the
 * booking is confirmed later when the student pays. Between those it stays `pending`,
 * which no longer means "awaiting the expert" — reading it that way has produced a
 * decline notice for an acceptance and an accept button that errors when pressed.
 */
export const awaitsWalletPayment = (chat: any, now: number = Date.now()): boolean => {
    if (!chat || chat.paymentMode !== 'wallet') return false;
    if (String(chat.status) !== 'pending') return false;
    if (!chat.paymentDeadline) return false;
    const due = new Date(chat.paymentDeadline).getTime();
    // A lapsed window is not "awaiting payment" — the sweep is about to release it.
    return Number.isFinite(due) && due > now;
};

/** Still the expert's to decide: nothing has been accepted or paid yet. */
export const awaitsExpertDecision = (chat: any, now: number = Date.now()): boolean =>
    String(chat?.status) === 'pending' && !awaitsWalletPayment(chat, now);

/**
 * Whether a pending request can still come to anything. Once its session time passes it
 * can no longer be accepted or paid for (the server refuses both), so continuing to show
 * it as "waiting for mentor approval" describes a decision that will never arrive.
 */
export const pendingRequestIsLive = (chat: any, now: number = Date.now()): boolean => {
    const at = new Date(chat?.start).getTime();
    // An undated request has no moment to have missed, so it stays visible.
    if (!Number.isFinite(at) || at <= 0) return true;
    return at > now;
};
