import { describe, expect, it } from 'vitest';
import { computeSessionCharge, DEFAULT_PRICING_RATES, validatePricingRates } from './bookingPrice';

const defaults = DEFAULT_PRICING_RATES;

describe('computeSessionCharge', () => {
  it('matches the server examples', () => {
    expect(computeSessionCharge(10000, defaults, 'oneToOne')).toMatchObject({
      platformFeeCents: 300,
      taxCents: 0,
      chargeCents: 10300,
      commissionCents: 2000,
      expertNetCents: 8000,
    });
    expect(computeSessionCharge(20000, defaults, 'seminar')).toMatchObject({
      platformFeeCents: 500,
      chargeCents: 20500,
      expertNetCents: 16000,
    });
    expect(computeSessionCharge(10000, { ...defaults, taxPercent: 8 }, 'oneToOne')).toMatchObject({
      taxCents: 824,
      chargeCents: 11124,
      expertNetCents: 8000,
    });
    expect(computeSessionCharge(0, defaults, 'seminar')).toMatchObject({
      platformFeeCents: 100,
      chargeCents: 100,
      expertNetCents: 0,
    });
    expect(computeSessionCharge(0, { ...defaults, taxPercent: 8 }, 'seminar')).toMatchObject({
      taxCents: 8,
      chargeCents: 108,
      expertNetCents: 0,
    });
    expect(computeSessionCharge(0, { ...defaults, freeSessionPlatformFeeDollars: 0, taxPercent: 8 }, 'oneToOne').chargeCents).toBe(0);
  });

  it('rejects a negative rate', () => {
    expect(validatePricingRates({ ...defaults, studentFeePercent: -1 }).ok).toBe(false);
  });
});
