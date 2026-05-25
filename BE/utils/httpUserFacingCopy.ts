/** Safe user-facing messages for HTTP 500 responses (never expose raw err.message). */

export const HTTP_GENERIC_ERROR = 'Something went wrong. Please try again.';

/** Intentional booking validation errors (from bookingValidation / bookingLeadTime). */
const BOOKING_VALIDATION_MESSAGES = new Set([
    'Invalid session start time',
    'Invalid session time range',
    "Session must fall within a single calendar day in the expert's timezone",
    'Session time is outside the bookable day window',
    'Expert has no availability configured',
    'Selected time is outside expert availability',
    'Expert is not accepting bookings on this date',
    'Selected time conflicts with an existing booking',
    'Selected time conflicts with an existing session',
    'Expert not found',
    'Payment intent not succeeded',
]);

const BOOKING_LEAD_TIME_MESSAGE = /must be at least \d+ hours in advance\.$/;

function isAllowedBookingHttpMessage(message: string): boolean {
    const trimmed = message.trim();
    return (
        BOOKING_VALIDATION_MESSAGES.has(trimmed) ||
        BOOKING_LEAD_TIME_MESSAGE.test(trimmed)
    );
}

/** For endpoints that may throw booking validation errors — still hides internal failures. */
export function safeHttp500Message(err: unknown): string {
    if (err instanceof Error && isAllowedBookingHttpMessage(err.message)) {
        return err.message.trim();
    }
    return safeErrorMessage(err);
}

export function safeErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        console.error(err.message);
    } else if (err != null) {
        console.error(err);
    }
    return HTTP_GENERIC_ERROR;
}
