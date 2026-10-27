// Mirror of BE/utils/bookingPrice.ts — keep the two in sync so the client and
// server always agree on the booking amount (the server re-checks it).

/** Price of a 1:1 booking in integer cents: (duration * hourlyRate) / 60. */
export function computeBookingPriceCents(durationMinutes: number, hourlyRateDollars: number): number {
  return Math.round((durationMinutes * hourlyRateDollars * 100) / 60);
}

/** Same price expressed in dollars (e.g. for display and Stripe amount inputs). */
export function computeBookingPriceDollars(durationMinutes: number, hourlyRateDollars: number): number {
  return computeBookingPriceCents(durationMinutes, hourlyRateDollars) / 100;
}

/**
 * Mirror of the server charge calculator. Display only — the server recomputes
 * the total and rejects a PaymentIntent that does not match.
 * Rounding is Math.round (half up). Inputs are non-negative, so half-up and
 * half-away-from-zero agree.
 */
export type PricingSessionType = 'seminar' | 'oneToOne';

export type CancellationRefundRule = 'full' | 'keep_platform_fee' | 'processing_fee';

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

export function formatDollarsFromCents(cents: number): string {
  return `$${(Math.round(Number(cents) || 0) / 100).toFixed(2)}`;
}
