const ALLOWED_NOTICE_HOURS = [24, 48, 72];

/**
 * @param {unknown} hours - expert.bookingNoticeHours from DB
 * @returns {24 | 48 | 72}
 */
function normalizeBookingNoticeHours(hours) {
  const n = Number(hours);
  return ALLOWED_NOTICE_HOURS.includes(n) ? n : 24;
}

/**
 * Throws if session start is sooner than expert's notice window from now.
 * @param { { bookingNoticeHours?: unknown } | null | undefined } expertDoc
 * @param { string | number | Date } sessionStart
 * @param { string } [messagePrefix]
 */
function assertBookingLeadTime(expertDoc, sessionStart, messagePrefix = "Bookings") {
  const h = normalizeBookingNoticeHours(expertDoc?.bookingNoticeHours);
  const startMs = new Date(sessionStart).getTime();
  if (Number.isNaN(startMs)) {
    throw new Error("Invalid session start time");
  }
  const minStart = Date.now() + h * 60 * 60 * 1000;
  if (startMs < minStart) {
    throw new Error(
      `${messagePrefix} must be at least ${h} hours in advance.`
    );
  }
}

const SCHEDULED_START_IN_PAST = "Pick a start time in the future.";

/**
 * The minimum booking notice binds students only — an expert may schedule inside their
 * own notice. What an expert schedules must still start in the future. Returns the
 * message to show the expert, or null when the start is in the future (or not a date at
 * all — that is left to the caller's own validation).
 * @param { string | number | Date } sessionStart
 * @param { number } [now]
 * @returns { string | null }
 */
function expertSchedulingPastStartError(sessionStart, now = Date.now()) {
  const startMs = new Date(sessionStart).getTime();
  if (Number.isNaN(startMs)) return null;
  return startMs > now ? null : SCHEDULED_START_IN_PAST;
}

module.exports = {
  ALLOWED_NOTICE_HOURS,
  SCHEDULED_START_IN_PAST,
  normalizeBookingNoticeHours,
  assertBookingLeadTime,
  expertSchedulingPastStartError,
};
