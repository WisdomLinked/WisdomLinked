/**
 * Advertised expert hourly rates (`User.price`) and seminar seat fees
 * (`GroupChat.price`) are stored in dollars, not cents. Do not divide by 100.
 */
export function formatPrice(
  amount: number | null | undefined,
  currency = 'USD',
): string | null {
  if (amount == null || Number.isNaN(amount) || !Number.isFinite(amount)) return null;
  if (amount === 0) return 'Free';
  const fractionDigits = amount % 1 === 0 ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/** Min hourly rate in dollars from `User.price` (a number or number[]). */
export function lowestHourlyRate(price: unknown): number | null {
  if (typeof price === 'number' && Number.isFinite(price)) return price;
  if (Array.isArray(price)) {
    const rates = price.map(Number).filter(n => Number.isFinite(n));
    return rates.length ? Math.min(...rates) : null;
  }
  return null;
}

/** 60 → "1 hr", 90 → "1.5 hr", 45 → "45 min". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  const label = Number.isInteger(hours) ? String(hours) : String(parseFloat(hours.toFixed(2)));
  return `${label} hr`;
}
