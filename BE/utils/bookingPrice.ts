// Single source of truth for booking price math.
// Mirrored on the client in FE/src/utils/bookingPrice.ts — keep the two in sync.

/** A succeeded Stripe PaymentIntent, or a falsy value when none matched that mode. */
export type PaymentIntentResult = false | null | undefined | { amount: number; currency: string };

/** Price of a 1:1 booking in integer cents: (duration * hourlyRate) / 60. */
export function computeBookingPriceCents(durationMinutes: number, hourlyRateDollars: number): number {
    return Math.round((durationMinutes * hourlyRateDollars * 100) / 60);
}

/** Convert a stored dollar price (e.g. a seminar price) to integer cents. */
export function dollarsToCents(dollars: unknown): number {
    return Math.round((Number(dollars ?? 0) || 0) * 100);
}

/** Experts store a single hourly rate, sometimes as a number, sometimes as [number]. */
export function extractHourlyRate(price: unknown): number {
    if (Array.isArray(price)) return Number(price[0] ?? 0) || 0;
    return Number(price ?? 0) || 0;
}

/**
 * Decide whether a booking requires payment and, if so, that the client actually
 * paid the server-computed amount. Pure so it can be unit-tested without Stripe.
 *
 * Returns `null` for the free path (expectedCents <= 0), or the verified charge
 * details for the paid path. Throws when payment is required but missing/invalid.
 */
export function assertPaymentMatchesExpected(
    expectedCents: number,
    payment_intent: string | undefined | null,
    testResult: PaymentIntentResult,
    liveResult: PaymentIntentResult,
): { paidBy: 'test' | 'live'; amount: number; currency: string } | null {
    if (expectedCents <= 0) return null; // free booking — no payment expected
    if (!payment_intent) {
        throw new Error("Payment intent is required");
    }
    if (!testResult && !liveResult) {
        throw new Error("Payment intent not succeeded");
    }
    const pi = (testResult || liveResult) as { amount: number; currency: string };
    if (pi.amount !== expectedCents) {
        throw new Error("Payment amount does not match expected price");
    }
    return { paidBy: testResult ? 'test' : 'live', amount: pi.amount, currency: pi.currency };
}
