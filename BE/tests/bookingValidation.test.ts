import { describe, it } from "node:test";
import assert from "node:assert/strict";
const {
  getSlotIndicesForRange,
  assertSlotsInTimeSlots,
  assertNotBlockedDate,
  intervalsOverlap,
  assertNoBookingOverlap,
  assertBookingSlotValid,
} = require("../utils/bookingValidation");

describe("bookingValidation", () => {
  it("getSlotIndicesForRange returns 30-minute indices in UTC", () => {
    const start = new Date("2026-05-01T09:00:00.000Z");
    const end = new Date("2026-05-01T10:00:00.000Z");
    const indices = getSlotIndicesForRange(start, end, "UTC");
    assert.deepEqual(indices, [18, 19]);
  });

  it("getSlotIndicesForRange throws on invalid range", () => {
    assert.throws(() =>
      getSlotIndicesForRange(
        new Date("2026-05-01T10:00:00.000Z"),
        new Date("2026-05-01T09:00:00.000Z"),
        "UTC"
      )
    );
  });

  it("assertSlotsInTimeSlots passes when all indices allowed", () => {
    const expert = { timeSlots: [18, 19, 20], timeZone: "UTC" };
    const start = new Date("2026-05-01T09:00:00.000Z");
    const end = new Date("2026-05-01T10:00:00.000Z");
    assert.doesNotThrow(() => assertSlotsInTimeSlots(expert, start, end));
  });

  it("assertSlotsInTimeSlots throws when slot missing", () => {
    const expert = { timeSlots: [18], timeZone: "UTC" };
    const start = new Date("2026-05-01T09:00:00.000Z");
    const end = new Date("2026-05-01T10:00:00.000Z");
    assert.throws(
      () => assertSlotsInTimeSlots(expert, start, end),
      /outside expert availability/
    );
  });

  it("assertSlotsInTimeSlots throws when no availability", () => {
    const expert = { timeSlots: [], timeZone: "UTC" };
    assert.throws(
      () =>
        assertSlotsInTimeSlots(
          expert,
          new Date("2026-05-01T09:00:00.000Z"),
          new Date("2026-05-01T10:00:00.000Z")
        ),
      /no availability configured/
    );
  });

  it("assertNotBlockedDate throws on blocked day", () => {
    const expert = { blockedBookingDates: ["2026-05-01"], timeZone: "UTC" };
    assert.throws(
      () => assertNotBlockedDate(expert, new Date("2026-05-01T14:00:00.000Z")),
      /not accepting bookings/
    );
  });

  it("intervalsOverlap detects partial overlap", () => {
    assert.equal(
      intervalsOverlap(
        "2026-05-01T09:00:00.000Z",
        "2026-05-01T10:00:00.000Z",
        "2026-05-01T09:30:00.000Z",
        "2026-05-01T11:00:00.000Z"
      ),
      true
    );
  });

  it("intervalsOverlap false for adjacent slots", () => {
    assert.equal(
      intervalsOverlap(
        "2026-05-01T09:00:00.000Z",
        "2026-05-01T10:00:00.000Z",
        "2026-05-01T10:00:00.000Z",
        "2026-05-01T11:00:00.000Z"
      ),
      false
    );
  });

  it("assertNoBookingOverlap throws when event overlaps", async () => {
    const Event = require("../models/Event");
    const GroupChat = require("../models/GroupChat");
    const originalEventFind = Event.find;
    const originalGroupFind = GroupChat.find;

    try {
      Event.find = () => ({
        select: async () => [
          {
            start: new Date("2026-05-01T09:00:00.000Z"),
            end: new Date("2026-05-01T10:00:00.000Z"),
            status: "accepted",
          },
        ],
      });
      GroupChat.find = () => ({
        select: async () => [],
      });

      await assert.rejects(
        () =>
          assertNoBookingOverlap(
            "expert1",
            new Date("2026-05-01T09:30:00.000Z"),
            new Date("2026-05-01T10:30:00.000Z")
          ),
        /conflicts with an existing booking/
      );
    } finally {
      Event.find = originalEventFind;
      GroupChat.find = originalGroupFind;
    }
  });

  it("assertBookingSlotValid happy path with empty bookings", async () => {
    const Event = require("../models/Event");
    const GroupChat = require("../models/GroupChat");
    const originalEventFind = Event.find;
    const originalGroupFind = GroupChat.find;

    try {
      Event.find = () => ({ select: async () => [] });
      GroupChat.find = () => ({ select: async () => [] });

      const expert = {
        _id: "expert1",
        timeSlots: [18, 19],
        timeZone: "UTC",
        blockedBookingDates: [],
      };
      await assert.doesNotReject(() =>
        assertBookingSlotValid(
          expert,
          new Date("2026-05-01T09:00:00.000Z"),
          new Date("2026-05-01T09:30:00.000Z")
        )
      );
    } finally {
      Event.find = originalEventFind;
      GroupChat.find = originalGroupFind;
    }
  });
});
