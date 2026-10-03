import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import metadata from 'libphonenumber-js/min/metadata';

/**
 * Stored phone numbers come in two shapes: digits only ("15454545454", from the profile form)
 * and "+15454545454" (from registration). The phone input works in E.164.
 */
export const phoneDigits = (value: string | null | undefined) => (value || '').replace(/\D/g, '');

/** Any stored shape → E.164 for the input; `undefined` when empty. */
export const toE164 = (stored: string | null | undefined) => {
  const digits = phoneDigits(stored);
  return digits ? `+${digits}` : undefined;
};

/** Input value → the digits-only format the profile has always saved. */
export const toStoredPhone = (e164: string | null | undefined) => phoneDigits(e164);

/** "+1", "+355": a calling code with no national digits (calling codes are prefix-free). */
export const isBareCallingCode = (value: string | null | undefined) =>
  !!value && /^\+\d{1,3}$/.test(value) && !!metadata.country_calling_codes[value.slice(1)];

/** Country of a stored number, else the fallback (e.g. profile country), else US. */
export const initialPhoneCountry = (
  stored: string | null | undefined,
  fallback?: string | null,
): CountryCode => {
  const e164 = toE164(stored);
  if (e164) {
    const parsed = parsePhoneNumberFromString(e164);
    const fromNumber =
      parsed?.country ?? (parsed ? metadata.country_calling_codes[parsed.countryCallingCode]?.[0] : undefined);
    if (fromNumber && isSupportedCountry(fromNumber)) return fromNumber;
  }
  const iso = fallback?.toUpperCase();
  return iso && isSupportedCountry(iso) ? iso : 'US';
};
