// Single source of truth for booking price math.
// Mirrored on the client in FE/src/utils/bookingPrice.ts — keep the two in sync.

/** The (expanded) charge on a PaymentIntent, carrying Stripe's receipt fields. */
export type StripeCharge = { receipt_url?: string | null; receipt_number?: string | null };

export type IntentMetadata = {
    bookingType?: string;
    groupChatId?: string;
    expertId?: string;
    userId?: string;
    seatRequest?: string;
};

/** A succeeded Stripe PaymentIntent, or a falsy value when none matched that mode. */
export type PaymentIntentResult =
    | false
    | null
    | undefined
    | {
          amount: number;
          currency: string;
          latest_charge?: StripeCharge | string | null;
          metadata?: IntentMetadata | null;
      };

/** Price of a 1:1 booking in integer cents: (duration * hourlyRate) / 60. */
export function computeBookingPriceCents(durationMinutes: number, hourlyRateDollars: number): number {
    return Math.round((durationMinutes * hourlyRateDollars * 100) / 60);
}

/** Convert a stored dollar price (e.g. a seminar price) to integer cents. */
export function dollarsToCents(dollars: unknown): number {
    return Math.round((Number(dollars ?? 0) || 0) * 100);
}

/**
 * The amount actually captured on a (possibly partially-captured) PaymentIntent. After
 * a partial capture Stripe leaves `amount` at the original authorization and puts the
 * captured total in `amount_received`, so recording `amount` would overstate the charge
 * and make later refunds/accounting wrong. Prefer `amount_received` when present.
 */
export function capturedAmountCents(intent: any): number {
    const received = Number(intent?.amount_received);
    if (Number.isFinite(received) && received > 0) return Math.round(received);
    return Math.max(0, Math.round(Number(intent?.amount ?? 0) || 0));
}

// Standard US card processing fee (2.9% + 30¢). Stripe keeps this on refunds, so a
// register-then-cancel loop would otherwise drain it from the platform on every cycle.
export const STRIPE_FEE_PERCENT = 0.029;
export const STRIPE_FEE_FIXED_CENTS = 30;

/**
 * Refund owed on a voluntary cancellation: the charge minus the non-recoverable
 * processing fee, never below 0. Retaining the fee makes register-then-leave abuse
 * cost-neutral for the platform instead of a per-cycle loss.
 */
export function voluntaryCancellationRefundCents(amountCents: unknown): number {
    const amount = Math.max(0, Math.round(Number(amountCents ?? 0) || 0));
    if (amount <= 0) return 0;
    const fee = Math.round(amount * STRIPE_FEE_PERCENT) + STRIPE_FEE_FIXED_CENTS;
    return Math.max(0, amount - fee);
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
): { paidBy: 'test' | 'live'; amount: number; currency: string; receiptUrl: string | null; receiptNumber: string | null; balanceTransaction: string | null } | null {
    if (expectedCents <= 0) return null; // free booking — no payment expected
    if (!payment_intent) {
        throw new Error("Payment intent is required");
    }
    if (!testResult && !liveResult) {
        throw new Error("Payment intent not succeeded");
    }
    const pi = (testResult || liveResult) as {
        amount: number;
        currency: string;
        latest_charge?: StripeCharge | string | null;
    };
    if (pi.amount !== expectedCents) {
        throw new Error("Payment amount does not match expected price");
    }
    const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    return {
        paidBy: testResult ? 'test' : 'live',
        amount: pi.amount,
        currency: pi.currency,
        receiptUrl: charge?.receipt_url ?? null,
        receiptNumber: charge?.receipt_number ?? null,
        balanceTransaction: balanceTransactionId(charge),
    };
}

/**
 * The balance transaction (`txn_…`) is the ledger entry a payout is made of, so it is
 * the reference finance reconciles against — distinct from the payment intent, which
 * identifies the payment itself. It only exists once funds have actually settled, so
 * a held or still-clearing charge has none yet.
 */
export function balanceTransactionId(charge: any): string | null {
    const bt = charge?.balance_transaction;
    if (!bt) return null;
    return typeof bt === 'string' ? bt : (bt.id ?? null);
}

export function assertIntentMatchesBooking(
    pi: PaymentIntentResult,
    expected: { userId: string; groupChatId?: string; expertId?: string },
): void {
    const meta: IntentMetadata = (pi && typeof pi === 'object' && pi.metadata) || {};
    if (expected.groupChatId) {
        if (
            String(meta.bookingType || '') !== 'groupChat' ||
            String(meta.groupChatId || '') !== String(expected.groupChatId)
        ) {
            throw new Error("This payment was not created for this booking");
        }
    }
    if (expected.expertId) {
        if (
            String(meta.bookingType || '') !== 'oneToOne' ||
            String(meta.expertId || '') !== String(expected.expertId)
        ) {
            throw new Error("This payment was not created for this booking");
        }
    }
    // The payer is bound to the account: an intent must carry the userId of whoever is
    // redeeming it. Skipping the check when metadata.userId was absent let any account
    // redeem another's intent for the same booking, so require a match whenever the
    // caller knows who is booking (every current caller does).
    if (expected.userId != null && String(expected.userId) !== '') {
        if (String(meta.userId || '') !== String(expected.userId)) {
            throw new Error("This payment was made from a different account");
        }
    }
}

export type BookingIntentInput =
    | { kind: 'oneToOne'; durationMinutes: number; hourlyRateDollars: number }
    | { kind: 'groupChat'; priceDollars: unknown };

export function expectedBookingIntentCents(input: BookingIntentInput): number {
    if (input.kind === 'oneToOne') {
        return computeBookingPriceCents(input.durationMinutes, input.hourlyRateDollars);
    }
    return dollarsToCents(input.priceDollars);
}
