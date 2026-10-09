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

describe("expertSchedulingLeadTimeError", () => {
  const { expertSchedulingLeadTimeError } = require("../utils/bookingLeadTime");
  const NOW = Date.parse("2026-10-08T12:00:00Z");
  const inHours = (h: number) => new Date(NOW + h * 3600_000).toISOString();

  it("names the expert's own notice when the start is inside it", () => {
    assert.equal(
      expertSchedulingLeadTimeError({ bookingNoticeHours: 48 }, inHours(47), "Seminars", NOW),
      "Seminars must be scheduled at least 48 hours in advance, as per your minimum booking notice.",
    );
  });

  it("allows a start exactly on the boundary", () => {
    assert.equal(expertSchedulingLeadTimeError({ bookingNoticeHours: 48 }, inHours(48), "Seminars", NOW), null);
  });

  it("follows each notice setting", () => {
    assert.match(expertSchedulingLeadTimeError({ bookingNoticeHours: 72 }, inHours(71), "1:1 sessions", NOW), /^1:1 sessions .* 72 hours/);
    assert.equal(expertSchedulingLeadTimeError({ bookingNoticeHours: 72 }, inHours(73), "1:1 sessions", NOW), null);
    assert.equal(expertSchedulingLeadTimeError({ bookingNoticeHours: 24 }, inHours(25), "1:1 sessions", NOW), null);
  });

  it("falls back to 24 hours like student bookings do", () => {
    assert.match(expertSchedulingLeadTimeError({}, inHours(23), "Seminars", NOW), /24 hours/);
    assert.equal(expertSchedulingLeadTimeError(null, inHours(25), "Seminars", NOW), null);
  });

  it("rejects a past start", () => {
    assert.match(expertSchedulingLeadTimeError({ bookingNoticeHours: 24 }, inHours(-1), "Seminars", NOW), /24 hours/);
  });

  it("leaves an unparseable start to the caller's own validation", () => {
    assert.equal(expertSchedulingLeadTimeError({ bookingNoticeHours: 24 }, "not a date", "Seminars", NOW), null);
  });
});
