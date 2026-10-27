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
        metadata?: IntentMetadata | null;
    };
    if (pi.amount !== expectedCents) {
        throw new Error("Payment amount does not match expected price");
    }
    const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    const pricing = pricingSnapshotFromMetadata((pi as any).metadata);
    return {
        paidBy: testResult ? 'test' : 'live',
        amount: pi.amount,
        currency: pi.currency,
        receiptUrl: charge?.receipt_url ?? null,
        receiptNumber: charge?.receipt_number ?? null,
        balanceTransaction: balanceTransactionId(charge),
        ...(pricing ? { pricing } : {}),
    };
}

/**
 * Cents to capture when settling an already-created PaymentIntent.
 * The intent's own authorized amount is captured when it is today's total,
 * the bare advertised price, or the fee-inclusive total stored on that intent
 * when it was created (yesterday's rates). A different amount is not that
 * authorization: the caller still compares it to today's total and rejects it.
 * Creating a new PaymentIntent is unchanged — that still uses today's total.
 */
export function settlementMatchCents(
    intentAmount: number,
    chargeCents: number,
    advertisedCents: number,
    snapshotChargeCents?: number | null,
): number {
    const authorized = Math.round(Number(intentAmount) || 0);
    const due = Math.max(0, Math.round(Number(chargeCents) || 0));
    const advertised = Math.max(0, Math.round(Number(advertisedCents) || 0));
    if (authorized === due) return due;
    if (advertised > 0 && authorized === advertised) return advertised;
    const snapshot = snapshotChargeCents == null
        ? null
        : Math.max(0, Math.round(Number(snapshotChargeCents) || 0));
    if (snapshot != null && snapshot > 0 && authorized === snapshot) return authorized;
    return due;
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

/**
 * Platform pricing. Seminar and 1:1 are independent.
 * Rounding is Math.round (half up). Every input here is a non-negative cent
 * amount or rate, so half-up and half-away-from-zero are the same result.
 * This is not a Stripe application fee and it is not subtracted from the charge.
 */
export type PricingSessionType = 'seminar' | 'oneToOne';

export type CancellationRefundRule = 'full' | 'keep_platform_fee' | 'processing_fee';

export const CANCELLATION_REFUND_RULES: readonly CancellationRefundRule[] = [
    'full',
    'keep_platform_fee',
    'processing_fee',
];

/** Today's behavior until an admin saves a different rule. */
export function defaultCancellationRefund(sessionType: PricingSessionType): CancellationRefundRule {
    return sessionType === 'oneToOne' ? 'full' : 'processing_fee';
}

export function isCancellationRefundRule(value: unknown): value is CancellationRefundRule {
    return value === 'full' || value === 'keep_platform_fee' || value === 'processing_fee';
}

export type PricingRates = {
    expertCommissionPercent: number;
    studentFeePercent: number;
    studentFeeCapDollars: number;
    taxPercent: number;
    freeSessionPlatformFeeDollars: number;
    cancellationRefund: CancellationRefundRule;
};

export const DEFAULT_PRICING_RATES: Omit<PricingRates, 'cancellationRefund'> = {
    expertCommissionPercent: 20,
    studentFeePercent: 3,
    studentFeeCapDollars: 5,
    taxPercent: 0,
    freeSessionPlatformFeeDollars: 1,
};

export type ChargeBreakdown = {
    sessionType: PricingSessionType;
    advertisedCents: number;
    platformFeeCents: number;
    taxCents: number;
    chargeCents: number;
    commissionCents: number;
    expertNetCents: number;
} & PricingRates;

const PERCENT_FIELDS = ['expertCommissionPercent', 'studentFeePercent', 'taxPercent'] as const;
const DOLLAR_FIELDS = ['studentFeeCapDollars', 'freeSessionPlatformFeeDollars'] as const;

const PERCENT_LABELS: Record<(typeof PERCENT_FIELDS)[number], string> = {
    expertCommissionPercent: 'Expert commission',
    studentFeePercent: 'Student fee',
    taxPercent: 'Tax',
};

const DOLLAR_LABELS: Record<(typeof DOLLAR_FIELDS)[number], string> = {
    studentFeeCapDollars: 'Student fee cap',
    freeSessionPlatformFeeDollars: 'Free-session platform fee',
};

function finiteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

/** Fill anything missing or unusable with the defaults. Used when reading stored settings. */
export function normalizePricingRates(
    input: unknown,
    sessionType: PricingSessionType = 'seminar',
): PricingRates {
    const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const percent = (key: (typeof PERCENT_FIELDS)[number]) => {
        const n = finiteNumber(src[key]);
        if (n == null || n < 0 || n > 100) return DEFAULT_PRICING_RATES[key];
        return n;
    };
    const dollars = (key: (typeof DOLLAR_FIELDS)[number]) => {
        const n = finiteNumber(src[key]);
        if (n == null || n < 0) return DEFAULT_PRICING_RATES[key];
        return n;
    };
    return {
        expertCommissionPercent: percent('expertCommissionPercent'),
        studentFeePercent: percent('studentFeePercent'),
        studentFeeCapDollars: dollars('studentFeeCapDollars'),
        taxPercent: percent('taxPercent'),
        freeSessionPlatformFeeDollars: dollars('freeSessionPlatformFeeDollars'),
        cancellationRefund: isCancellationRefundRule(src.cancellationRefund)
            ? src.cancellationRefund
            : defaultCancellationRefund(sessionType),
    };
}

/** Reject negatives. Percents must be 0 through 100 inclusive. Does not coerce. */
export function validatePricingRates(
    input: unknown,
    sessionType: PricingSessionType = 'seminar',
): { ok: true; rates: PricingRates } | { ok: false; error: string } {
    if (!input || typeof input !== 'object') {
        return { ok: false, error: 'Pricing settings are missing.' };
    }
    const src = input as Record<string, unknown>;
    const rates = {} as PricingRates;
    for (const key of PERCENT_FIELDS) {
        const n = finiteNumber(src[key]);
        if (n == null || n < 0 || n > 100) {
            return { ok: false, error: `${PERCENT_LABELS[key]} must be between 0 and 100.` };
        }
        rates[key] = n;
    }
    for (const key of DOLLAR_FIELDS) {
        const n = finiteNumber(src[key]);
        if (n == null || n < 0) {
            return { ok: false, error: `${DOLLAR_LABELS[key]} cannot be negative.` };
        }
        rates[key] = n;
    }
    if (src.cancellationRefund == null || src.cancellationRefund === '') {
        rates.cancellationRefund = defaultCancellationRefund(sessionType);
    } else if (!isCancellationRefundRule(src.cancellationRefund)) {
        return { ok: false, error: 'Cancellation refund must be full, keep the platform fee, or the card processing fee.' };
    } else {
        rates.cancellationRefund = src.cancellationRefund;
    }
    return { ok: true, rates };
}

export function validatePricingSettings(input: unknown):
    | { ok: true; seminar: PricingRates; oneToOne: PricingRates }
    | { ok: false; error: string } {
    const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const seminar = validatePricingRates(src.seminar, 'seminar');
    if (!seminar.ok) return { ok: false, error: `Seminar: ${seminar.error}` };
    const oneToOne = validatePricingRates(src.oneToOne, 'oneToOne');
    if (!oneToOne.ok) return { ok: false, error: `1:1: ${oneToOne.error}` };
    return { ok: true, seminar: seminar.rates, oneToOne: oneToOne.rates };
}

/**
 * Cents to refund when a student cancels before the session starts.
 * The rule is the current setting, not a value stored on the payment.
 * Never returns more than the amount charged. A result of 0 means do not call Stripe.
 */
export function cancellationRefundCents(
    rule: CancellationRefundRule,
    payment: {
        amount?: number | null;
        advertisedCents?: number | null;
        taxCents?: number | null;
    },
): number {
    const amount = Math.max(0, Math.round(Number(payment?.amount) || 0));
    if (rule === 'full') return amount;
    if (rule === 'processing_fee') return voluntaryCancellationRefundCents(amount);
    const hasSnapshot = typeof payment?.advertisedCents === 'number' && Number.isFinite(payment.advertisedCents);
    if (!hasSnapshot) return amount;
    const advertised = Math.max(0, Math.round(Number(payment.advertisedCents) || 0));
    const tax = Math.max(0, Math.round(Number(payment?.taxCents) || 0));
    return Math.min(amount, advertised + tax);
}

/**
 * Student charge and expert net for one advertised price.
 * Paid: percent fee, capped, then tax on advertised + fee. Commission is expert-side only.
 * Free (advertised 0): flat platform fee, tax on that fee, no commission.
 * A free-session fee of 0 is truly free: no tax and no charge.
 * Rounding is Math.round (half up). Inputs are non-negative, so half-up and
 * half-away-from-zero agree.
 */
export function computeSessionCharge(
    advertisedCents: number,
    ratesInput: Partial<PricingRates> | null | undefined,
    sessionType: PricingSessionType,
): ChargeBreakdown {
    const rates = normalizePricingRates(
        { ...DEFAULT_PRICING_RATES, ...(ratesInput || {}) },
        sessionType,
    );
    const advertised = Math.max(0, Math.round(Number(advertisedCents) || 0));
    const capCents = Math.max(0, Math.round(rates.studentFeeCapDollars * 100));
    const freeFeeCents = Math.max(0, Math.round(rates.freeSessionPlatformFeeDollars * 100));

    let platformFeeCents = 0;
    let taxCents = 0;
    let commissionCents = 0;
    let expertNetCents = 0;

    if (advertised > 0) {
        platformFeeCents = Math.min(
            Math.round((advertised * rates.studentFeePercent) / 100),
            capCents,
        );
        const taxBaseCents = advertised + platformFeeCents;
        taxCents = rates.taxPercent > 0 ? Math.round((taxBaseCents * rates.taxPercent) / 100) : 0;
        commissionCents = Math.round((advertised * rates.expertCommissionPercent) / 100);
        expertNetCents = advertised - commissionCents;
    } else if (freeFeeCents > 0) {
        platformFeeCents = freeFeeCents;
        taxCents = rates.taxPercent > 0 ? Math.round((platformFeeCents * rates.taxPercent) / 100) : 0;
    }

    return {
        sessionType,
        advertisedCents: advertised,
        platformFeeCents,
        taxCents,
        chargeCents: advertised + platformFeeCents + taxCents,
        commissionCents,
        expertNetCents,
        ...rates,
    };
}

/** Fields copied onto a new PaymentHistory charge. Absent on old intents. */
export function pricingSnapshotFromMetadata(meta: any): Record<string, number | string> | null {
    if (!meta || meta.advertisedCents == null || meta.advertisedCents === '') return null;
    const num = (key: string) => {
        const n = Number(meta[key]);
        return Number.isFinite(n) ? n : 0;
    };
    const cents = (key: string) => Math.max(0, Math.round(num(key)));
    const sessionType: PricingSessionType = meta.sessionType === 'seminar' ? 'seminar' : 'oneToOne';
    return {
        sessionType,
        advertisedCents: cents('advertisedCents'),
        platformFeeCents: cents('platformFeeCents'),
        taxCents: cents('taxCents'),
        commissionCents: cents('commissionCents'),
        expertNetCents: cents('expertNetCents'),
        expertCommissionPercent: num('expertCommissionPercent'),
        studentFeePercent: num('studentFeePercent'),
        studentFeeCapDollars: num('studentFeeCapDollars'),
        taxPercent: num('taxPercent'),
        freeSessionPlatformFeeDollars: num('freeSessionPlatformFeeDollars'),
    };
}

export function pricingMetadata(breakdown: ChargeBreakdown): Record<string, string> {
    return {
        sessionType: breakdown.sessionType,
        advertisedCents: String(breakdown.advertisedCents),
        platformFeeCents: String(breakdown.platformFeeCents),
        taxCents: String(breakdown.taxCents),
        commissionCents: String(breakdown.commissionCents),
        expertNetCents: String(breakdown.expertNetCents),
        expertCommissionPercent: String(breakdown.expertCommissionPercent),
        studentFeePercent: String(breakdown.studentFeePercent),
        studentFeeCapDollars: String(breakdown.studentFeeCapDollars),
        taxPercent: String(breakdown.taxPercent),
        freeSessionPlatformFeeDollars: String(breakdown.freeSessionPlatformFeeDollars),
    };
}

export function historyPricing(charge: any): Record<string, number | string> {
    const pricing = charge?.pricing;
    if (!pricing || typeof pricing !== 'object') return {};
    return pricing;
}

/** Student total stored on a server-created intent, or null when it has no snapshot. */
export function snapshotChargeCents(meta: any): number | null {
    const snap = pricingSnapshotFromMetadata(meta);
    if (!snap) return null;
    const total = Number(snap.advertisedCents) + Number(snap.platformFeeCents) + Number(snap.taxCents);
    if (!Number.isFinite(total)) return null;
    return Math.max(0, Math.round(total));
}
