export const RETRY_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;

export const MIN_RETRY_LINK_LIFETIME_MS = 31 * 60 * 1000;

export const RETRY_LINK_SESSION_STARTED =
    'This session has already started, so a payment link can no longer be sent.';
export const RETRY_LINK_SESSION_TOO_SOON =
    'This session starts in less than 30 minutes, so a payment link can no longer be sent.';

export type RetryLinkExpiry =
    | { ok: true; expiresAtMs: number }
    | { ok: false; message: string };

const toMs = (value: unknown): number | null => {
    if (value == null || value === '') return null;
    const ms = value instanceof Date ? value.getTime() : new Date(value as any).getTime();
    return Number.isFinite(ms) ? ms : null;
};

export function retryLinkExpiry(nowMs: number, sessionStart?: unknown): RetryLinkExpiry {
    const startMs = toMs(sessionStart);
    if (startMs !== null && startMs <= nowMs) {
        return { ok: false, message: RETRY_LINK_SESSION_STARTED };
    }
    const expiresAtMs = Math.min(nowMs + RETRY_LINK_LIFETIME_MS, startMs ?? Infinity);
    if (expiresAtMs - nowMs < MIN_RETRY_LINK_LIFETIME_MS) {
        return { ok: false, message: RETRY_LINK_SESSION_TOO_SOON };
    }
    return { ok: true, expiresAtMs };
}

export function checkoutPaymentMetadata(
    session: { metadata?: Record<string, string> | null } | null | undefined,
    paymentLinkMetadata?: Record<string, string> | null,
): Record<string, string> {
    if (paymentLinkMetadata && Object.keys(paymentLinkMetadata).length) return paymentLinkMetadata;
    return session?.metadata || {};
}
