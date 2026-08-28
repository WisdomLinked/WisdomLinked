export type PaymentMode = 'card' | 'wallet';

export const WALLET_PAYMENT_METHOD_TYPES = ['alipay', 'wechat_pay'];

export const CARD_PAYMENT_METHOD_TYPES = ['card'];

export const DEFAULT_PAYMENT_WINDOW_HOURS = 48;

export const normalizePaymentMode = (value: any): PaymentMode =>
    String(value) === 'wallet' ? 'wallet' : 'card';

export const isWallet = (value: any): boolean => normalizePaymentMode(value) === 'wallet';

// One window governs every booking a student still owes money on, whichever rail it
// settles on: a wallet request the expert accepted, or an offer the expert made.
export const paymentWindowHours = (appState: any): number => {
    const hours = appState?.paymentWindowHours;
    if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) {
        return DEFAULT_PAYMENT_WINDOW_HOURS;
    }
    return Math.min(hours, 168);
};

// The payer's window: for a wallet booking it opens when the expert says yes, for an
// expert's offer it opens the moment the offer is made. It never runs past the session
// itself — paying after the start would buy nothing — and it is never returned in the
// past, so a session offered at the last minute still gets a (short) chance to be paid
// rather than being born already expired.
export const paymentWindowDeadline = ({
    sessionStartMs,
    windowHours = DEFAULT_PAYMENT_WINDOW_HOURS,
    now = Date.now(),
}: {
    sessionStartMs?: number;
    windowHours?: number;
    now?: number;
}): Date => {
    const byWindow = now + windowHours * 60 * 60 * 1000;
    const deadline = typeof sessionStartMs === 'number' && sessionStartMs > now && sessionStartMs < byWindow
        ? sessionStartMs
        : byWindow;
    return new Date(Math.max(deadline, now));
};

export const paymentWindowLapsed = (deadline: any, now = Date.now()): boolean => {
    if (!deadline) return false;
    const ms = deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime();
    if (!Number.isFinite(ms)) return false;
    return ms <= now;
};

// Wallets (WeChat Pay, Alipay) settle immediately and cannot be authorized, so they
// may only be charged at a point where the money is already earned: a seminar with a
// free seat, or a request the expert has already accepted. Every other booking path
// depends on holding funds while someone decides, which only a card can do.
export type WalletChargeContext =
    | { flow: 'seminarOpenSeat' }
    | { flow: 'seminarSeatRequest'; approved: boolean }
    | { flow: 'oneToOne'; approved: boolean };

export const walletChargeAllowed = (context: WalletChargeContext): boolean => {
    switch (context.flow) {
        case 'seminarOpenSeat':
            return true;
        case 'seminarSeatRequest':
        case 'oneToOne':
            return context.approved;
        default:
            return false;
    }
};

// A booking taken through the wallet path skipped the card authorization that normally
// commits a student before an expert spends time deciding on it. Letting it settle by
// card afterwards would turn the wallet tab into a way for anyone to opt out of that
// commitment, so the mode a booking was requested under is the mode it must be paid in.
// The server derives this from the stored booking; the client never chooses it.
export const pinnedSettlementMode = (requestedMode: any): PaymentMode =>
    isWallet(requestedMode) ? 'wallet' : 'card';

export const WALLET_ONLY_SETTLEMENT_MESSAGE =
    'This booking was requested with WeChat Pay or Alipay, so it must be paid the same way.';

export const WALLET_NEEDS_APPROVAL_MESSAGE =
    'WeChat Pay and Alipay cannot hold funds, so this booking is sent as a request first. You pay only after it is accepted.';

export const WALLET_NOT_YET_PAYABLE =
    'This booking has not been accepted yet, so there is nothing to pay for. We will email you the moment it is accepted.';

export const walletWindowExpiredMessage = (what: string): string =>
    `The payment window for your ${what} has closed, so it has been released. Please book again if you still want it.`;

export const walletPayNowMessage = (deadline: any): string => {
    const when = deadline ? new Date(deadline).toLocaleString() : '';
    return when
        ? `Your request was accepted. Please complete payment by ${when} to confirm it.`
        : 'Your request was accepted. Please complete payment to confirm it.';
};
