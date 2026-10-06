import { describe, expect, it } from 'vitest';
import {
  initialPhoneCountry,
  isBareCallingCode,
  isPhoneValid,
  phoneDigits,
  splitPhone,
  toE164,
  toStoredPhone,
} from './phone';

describe('phone normalization', () => {
  it('loads digits-only and +-prefixed stored values as E.164', () => {
    expect(toE164('15454545454')).toBe('+15454545454');
    expect(toE164('+15454545454')).toBe('+15454545454');
    expect(toE164('+1 (545) 454-5454')).toBe('+15454545454');
  });

  it('treats empty stored values as no value', () => {
    expect(toE164('')).toBeUndefined();
    expect(toE164(null)).toBeUndefined();
    expect(toE164(undefined)).toBeUndefined();
  });

  it('saves in the digits-only profile format', () => {
    expect(toStoredPhone('+15454545454')).toBe('15454545454');
    expect(toStoredPhone('+919876543210')).toBe('919876543210');
    expect(toStoredPhone('')).toBe('');
  });

  it('treats a calling code with no national digits as a bare code', () => {
    expect(isBareCallingCode('+1')).toBe(true);
    expect(isBareCallingCode('+355')).toBe(true);
    expect(isBareCallingCode('+12')).toBe(false);
    expect(isBareCallingCode('+3551')).toBe(false);
    expect(isBareCallingCode('')).toBe(false);
  });

  it('picks the phone country from the stored number, then the fallback, then US', () => {
    expect(initialPhoneCountry('+12025550123', 'AL')).toBe('US');
    expect(initialPhoneCountry('919876543210', 'AL')).toBe('IN');
    expect(initialPhoneCountry('15454545454', 'AL')).toBe('US');
    expect(initialPhoneCountry('', 'AL')).toBe('AL');
    expect(initialPhoneCountry(undefined, 'zz')).toBe('US');
  });

  it('requires at least 8 digits including the calling code', () => {
    expect(isPhoneValid('+15454545454')).toBe(true);
    expect(isPhoneValid('+44207183')).toBe(true);
    expect(isPhoneValid('+4420718')).toBe(false);
    expect(isPhoneValid('')).toBe(false);
  });

  it('splits E.164 into calling code and national digits', () => {
    expect(splitPhone('+442071838750')).toEqual({ countryCode: '+44', national: '2071838750' });
    expect(splitPhone('+15454545454')).toEqual({ countryCode: '+1', national: '5454545454' });
    expect(splitPhone('')).toEqual({ countryCode: '', national: '' });
  });

  it('round-trips existing values without changing their digits', () => {
    for (const stored of ['15454545454', '+15454545454', '919876543210']) {
      expect(phoneDigits(toStoredPhone(toE164(stored)))).toBe(phoneDigits(stored));
    }
  });
});
