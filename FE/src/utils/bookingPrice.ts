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
