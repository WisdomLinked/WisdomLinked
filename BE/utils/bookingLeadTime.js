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

module.exports = {
  ALLOWED_NOTICE_HOURS,
  normalizeBookingNoticeHours,
  assertBookingLeadTime,
};
