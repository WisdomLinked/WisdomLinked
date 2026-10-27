import { describe, it } from "node:test";
import assert from "node:assert/strict";
const {
  normalizeBookingNoticeHours,
  assertBookingLeadTime,
} = require("../utils/bookingLeadTime");

describe("bookingLeadTime", () => {
  it("normalizeBookingNoticeHours accepts 24/48/72", () => {
    assert.equal(normalizeBookingNoticeHours(24), 24);
    assert.equal(normalizeBookingNoticeHours(48), 48);
    assert.equal(normalizeBookingNoticeHours(72), 72);
  });

  it("normalizeBookingNoticeHours defaults invalid to 24", () => {
    assert.equal(normalizeBookingNoticeHours(12), 24);
    assert.equal(normalizeBookingNoticeHours(undefined), 24);
  });

  it("assertBookingLeadTime throws when start too soon", () => {
    const expert = { bookingNoticeHours: 24 };
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    assert.throws(
      () => assertBookingLeadTime(expert, soon),
      /24 hours in advance/
    );
  });
});

describe("expertSchedulingPastStartError", () => {
  const { expertSchedulingPastStartError, SCHEDULED_START_IN_PAST } = require("../utils/bookingLeadTime");
  const NOW = Date.parse("2026-10-08T12:00:00Z");
  const inHours = (h: number) => new Date(NOW + h * 3600_000).toISOString();

  it("allows a start inside any booking notice window", () => {
    assert.equal(expertSchedulingPastStartError(inHours(0.25), NOW), null);
    assert.equal(expertSchedulingPastStartError(inHours(23), NOW), null);
    assert.equal(expertSchedulingPastStartError(inHours(71), NOW), null);
  });

  it("allows a start far in the future", () => {
    assert.equal(expertSchedulingPastStartError(inHours(500), NOW), null);
  });

  it("rejects a start in the past", () => {
    assert.equal(expertSchedulingPastStartError(inHours(-1), NOW), SCHEDULED_START_IN_PAST);
  });

  it("rejects a start exactly at the current moment", () => {
    assert.equal(expertSchedulingPastStartError(new Date(NOW).toISOString(), NOW), SCHEDULED_START_IN_PAST);
  });

  it("leaves an unparseable start to the caller's own validation", () => {
    assert.equal(expertSchedulingPastStartError("not a date", NOW), null);
  });
});

describe("seminarRegistrationClosedError", () => {
  const { seminarRegistrationClosedError, SEMINAR_ALREADY_STARTED } = require("../utils/bookingLeadTime");
  const NOW = Date.parse("2026-10-08T12:00:00Z");
  const inHours = (h: number) => new Date(NOW + h * 3600_000).toISOString();

  it("allows registering for a seminar starting within the booking notice", () => {
    assert.equal(seminarRegistrationClosedError(inHours(23), NOW), null);
    assert.equal(seminarRegistrationClosedError(inHours(1), NOW), null);
    assert.equal(seminarRegistrationClosedError(inHours(1 / 60), NOW), null);
  });

  it("allows registering for a seminar far in the future", () => {
    assert.equal(seminarRegistrationClosedError(inHours(500), NOW), null);
  });

  it("closes registration once the seminar has started", () => {
    assert.equal(seminarRegistrationClosedError(new Date(NOW).toISOString(), NOW), SEMINAR_ALREADY_STARTED);
    assert.equal(seminarRegistrationClosedError(inHours(-0.5), NOW), SEMINAR_ALREADY_STARTED);
    assert.equal(seminarRegistrationClosedError(inHours(-48), NOW), SEMINAR_ALREADY_STARTED);
  });

  it("treats a missing or invalid start as closed", () => {
    assert.equal(seminarRegistrationClosedError(undefined, NOW), SEMINAR_ALREADY_STARTED);
    assert.equal(seminarRegistrationClosedError("not a date", NOW), SEMINAR_ALREADY_STARTED);
  });
});
