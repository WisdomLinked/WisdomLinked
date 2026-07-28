/** User-visible booking and payment error strings. */

export const BOOKING_PAYMENT_AMOUNT_INVALID = 'Payment amount could not be validated. Please try again.';

export const BOOKING_PAYMENT_FAILED = 'Payment failed. Please try again.';

export const BOOKING_APPOINTMENT_UNAVAILABLE = 'This time is no longer available. Choose another slot.';

export const BOOKING_EXPERT_UNAVAILABLE = 'This expert is not available for booking right now.';

/** The intent's metadata doesn't name this payer or this booking. */
export const BOOKING_PAYMENT_WRONG_BOOKING = 'This payment does not belong to this booking.';

/** Generic verification failure — the server could not confirm an allowed payment state. */
export const BOOKING_PAYMENT_UNVERIFIED = 'Payment could not be verified, so you have not been charged. Please try again.';

/** A hold could not be turned into a charge; the booking is rolled back. */
export const BOOKING_CAPTURE_FAILED = "We couldn't complete your payment, so you have not been charged. Please try again.";

/** Capture succeeded but the booking didn't; refund is in flight. */
export const BOOKING_CAPTURED_NOT_BOOKED = "We couldn't complete your booking. Your payment has been refunded.";

/** A concurrent request already redeemed this intent. */
export const BOOKING_PAYMENT_ALREADY_USED = 'This payment has already been used for a booking.';
