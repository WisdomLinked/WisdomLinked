import test from "node:test";
import assert from "node:assert/strict";
import { isExpertSetupComplete } from "../utils/expertSetup";

const complete = (overrides: Record<string, unknown> = {}) => ({
    price: [25],
    appointmentDurations: [30, 60],
    bufferMinutes: 15,
    bookingNoticeHours: 24,
    availabilityMode: "common",
    timeSlots: [18, 19],
    ...overrides,
});

test("an expert with all four steps done is complete", () => {
    assert.equal(isExpertSetupComplete(complete()), true);
});

test("a missing user is never complete", () => {
    assert.equal(isExpertSetupComplete(null), false);
    assert.equal(isExpertSetupComplete(undefined), false);
});

test("hourly rate: needs a saved rate of at least $5 that is not still pending", () => {
    assert.equal(isExpertSetupComplete(complete({ price: [4] })), false);
    assert.equal(isExpertSetupComplete(complete({ price: [] })), false);
    assert.equal(isExpertSetupComplete(complete({ price: [5] })), true);
    assert.equal(isExpertSetupComplete(complete({ pendingSetupSteps: ["rate"] })), false);
});

test("session lengths: still pending blocks, saved lengths pass", () => {
    assert.equal(isExpertSetupComplete(complete({ pendingSetupSteps: ["durations"] })), false);
    assert.equal(isExpertSetupComplete(complete({ pendingSetupSteps: [] })), true);
});

test("booking rules: an expert who never picked a buffer is incomplete", () => {
    assert.equal(isExpertSetupComplete(complete({ bufferMinutes: undefined })), false);
    assert.equal(isExpertSetupComplete(complete({ bufferMinutes: 20 })), false);
    assert.equal(isExpertSetupComplete(complete({ bufferMinutes: 0 })), true);
    assert.equal(isExpertSetupComplete(complete({ bufferMinutes: "30" })), true);
});

test("booking rules: a notice the expert has not chosen yet is incomplete", () => {
    assert.equal(isExpertSetupComplete(complete({ pendingSetupSteps: ["notice"] })), false);
    assert.equal(isExpertSetupComplete(complete({ pendingSetupSteps: ["rate", "durations", "notice"] })), false);
});

test("booking rules: notice must be 24, 48 or 72 hours", () => {
    assert.equal(isExpertSetupComplete(complete({ bookingNoticeHours: 12 })), false);
    assert.equal(isExpertSetupComplete(complete({ bookingNoticeHours: undefined })), false);
    assert.equal(isExpertSetupComplete(complete({ bookingNoticeHours: 72 })), true);
});

test("weekly time slots: the same-every-day mode needs at least one hour", () => {
    assert.equal(isExpertSetupComplete(complete({ timeSlots: [] })), false);
    assert.equal(isExpertSetupComplete(complete({ timeSlots: [99] })), false);
    assert.equal(isExpertSetupComplete(complete({ timeSlots: undefined })), false);
});

test("weekly time slots: per-weekday mode reads the weekly map, not timeSlots", () => {
    const daily = { availabilityMode: "daily", timeSlots: [] };
    assert.equal(isExpertSetupComplete(complete({ ...daily, weeklyTimeSlots: { Tue: [20] } })), true);
    assert.equal(isExpertSetupComplete(complete({ ...daily, weeklyTimeSlots: { Tue: [] } })), false);
    assert.equal(isExpertSetupComplete(complete({ ...daily, weeklyTimeSlots: undefined, timeSlots: [18] })), false);
    assert.equal(isExpertSetupComplete(complete({ ...daily, weeklyTimeSlots: new Map([["Sun", [2]]]) })), true);
});
