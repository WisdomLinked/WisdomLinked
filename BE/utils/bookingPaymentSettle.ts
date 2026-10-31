/**
 * WeChat Pay and Alipay can redirect the browser with redirect_status=succeeded
 * a few seconds before the PaymentIntent status is succeeded. That gap is not a decline.
 */

export function paymentIntentStillSettling(intent: any): boolean {
    if (!intent || typeof intent !== 'object') return false;
    if (intent.last_payment_error) return false;
    const status = String(intent.status || '');
    if (
        status === 'canceled'
        || status === 'succeeded'
        || status === 'processing'
        || status === 'requires_capture'
    ) {
        return false;
    }
    return status === 'requires_action'
        || status === 'requires_confirmation'
        || status === 'requires_payment_method';
}

/** How many extra reads to make after the first unsettled check. Default covers the ~3s WeChat test gap. */
export function bookingSettlePollCount(): number {
    const raw = Number(process.env.BOOKING_SETTLE_POLLS);
    if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
    return 6;
}

export function bookingSettlePollMs(): number {
    const raw = Number(process.env.BOOKING_SETTLE_POLL_MS);
    if (Number.isFinite(raw) && raw >= 0) return raw;
    return 1000;
}
