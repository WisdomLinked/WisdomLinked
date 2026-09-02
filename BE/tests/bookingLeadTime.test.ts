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
