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

/**
 * The expert's own notice applies to what they schedule too: a seminar published, or a
 * 1:1 proposed, inside it is one no student is allowed to book. Returns the message to
 * show the expert, or null when the start is far enough out (or not a date at all —
 * that is left to the caller's own validation).
 * @param { { bookingNoticeHours?: unknown } | null | undefined } expertDoc
 * @param { string | number | Date } sessionStart
 * @param { string } what - e.g. "Seminars", "1:1 sessions"
 * @param { number } [now]
 * @returns { string | null }
 */
function expertSchedulingLeadTimeError(expertDoc, sessionStart, what, now = Date.now()) {
  const h = normalizeBookingNoticeHours(expertDoc?.bookingNoticeHours);
  const startMs = new Date(sessionStart).getTime();
  if (Number.isNaN(startMs)) return null;
  if (startMs >= now + h * 60 * 60 * 1000) return null;
  return `${what} must be scheduled at least ${h} hours in advance, as per your minimum booking notice.`;
}

module.exports = {
  ALLOWED_NOTICE_HOURS,
  normalizeBookingNoticeHours,
  assertBookingLeadTime,
  expertSchedulingLeadTimeError,
};
