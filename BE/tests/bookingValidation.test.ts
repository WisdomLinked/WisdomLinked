import { describe, it } from "node:test";
import assert from "node:assert/strict";
const {
  getSlotIndicesForRange,
  assertSlotsInTimeSlots,
  assertNotBlockedDate,
  assertNotBlockedSlot,
  intervalsOverlap,
  assertNoBookingOverlap,
  assertDurationAllowed,
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

  it("assertNotBlockedSlot throws when a needed slot is blocked on that date", () => {
    // 09:00–10:00 UTC maps to half-hour indices 18, 19.
    const expert = {
      blockedBookingSlots: { "2026-05-01": [18, 19] },
      timeZone: "UTC",
    };
    assert.throws(
      () =>
        assertNotBlockedSlot(
          expert,
          new Date("2026-05-01T09:00:00.000Z"),
          new Date("2026-05-01T10:00:00.000Z")
        ),
      /not available at the selected time on this date/
    );
  });

  it("assertNotBlockedSlot passes when the date has no blocked slots overlapping", () => {
    const expert = {
      blockedBookingSlots: { "2026-05-01": [20, 21] },
      timeZone: "UTC",
    };
    assert.doesNotThrow(() =>
      assertNotBlockedSlot(
        expert,
        new Date("2026-05-01T09:00:00.000Z"),
        new Date("2026-05-01T10:00:00.000Z")
      )
    );
    // Different date entirely → not blocked.
    assert.doesNotThrow(() =>
      assertNotBlockedSlot(
        expert,
        new Date("2026-05-02T09:00:00.000Z"),
        new Date("2026-05-02T10:00:00.000Z")
      )
    );
  });

  it("assertNotBlockedSlot supports a Map-valued blockedBookingSlots", () => {
    const expert = {
      blockedBookingSlots: new Map([["2026-05-01", [18, 19]]]),
      timeZone: "UTC",
    };
    assert.throws(
      () =>
        assertNotBlockedSlot(
          expert,
          new Date("2026-05-01T09:00:00.000Z"),
          new Date("2026-05-01T10:00:00.000Z")
        ),
      /not available at the selected time on this date/
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

  it("assertDurationAllowed passes when duration is offered", () => {
    const expert = { appointmentDurations: [60, 90] };
    assert.doesNotThrow(() => assertDurationAllowed(expert, 60));
    assert.doesNotThrow(() => assertDurationAllowed(expert, 90));
  });

  it("assertDurationAllowed defaults to all durations when expert field missing", () => {
    const expert = {};
    assert.doesNotThrow(() => assertDurationAllowed(expert, 30));
    assert.doesNotThrow(() => assertDurationAllowed(expert, 60));
    assert.doesNotThrow(() => assertDurationAllowed(expert, 90));
  });

  it("assertDurationAllowed throws when duration not offered", () => {
    const expert = { appointmentDurations: [60] };
    assert.throws(
      () => assertDurationAllowed(expert, 90),
      /does not offer sessions of this duration/,
    );
    assert.throws(
      () => assertDurationAllowed(expert, 30),
      /does not offer sessions of this duration/,
    );
  });

  it("assertDurationAllowed coerces string duration", () => {
    const expert = { appointmentDurations: [60, 90] };
    assert.doesNotThrow(() => assertDurationAllowed(expert, "60"));
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
