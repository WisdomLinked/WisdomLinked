import { describe, it } from "node:test";
import assert from "node:assert/strict";
const {
  getSlotIndexInTimeZone,
  toYMDInTimeZone,
  assertNotBlockedDate,
} = require("../utils/bookingValidation");

describe("bookingValidation timezone", () => {
  it("getSlotIndexInTimeZone differs by zone for same instant", () => {
    const instant = new Date("2026-05-01T14:00:00.000Z");
    const utcIdx = getSlotIndexInTimeZone(instant, "UTC");
    const nyIdx = getSlotIndexInTimeZone(instant, "America/New_York");
    assert.notEqual(utcIdx, nyIdx);
  });

  it("assertNotBlockedDate uses expert timezone calendar day", () => {
    const expert = {
      blockedBookingDates: ["2026-05-01"],
      timeZone: "UTC",
    };
    assert.throws(
      () => assertNotBlockedDate(expert, new Date("2026-05-01T12:00:00.000Z")),
      /not accepting bookings/
    );
    const ymd = toYMDInTimeZone("2026-05-01T12:00:00.000Z", "UTC");
    assert.equal(ymd, "2026-05-01");
  });
});
