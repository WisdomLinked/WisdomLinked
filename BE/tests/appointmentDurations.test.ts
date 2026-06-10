import { describe, it } from "node:test";
import assert from "node:assert/strict";
const {
  VALID_APPOINTMENT_DURATIONS,
  normalizeAppointmentDurations,
  parseAppointmentDurationsInput,
  appointmentDurationsEqual,
} = require("../utils/appointmentDurations");

describe("appointmentDurations", () => {
  it("exports valid duration constants", () => {
    assert.deepEqual(VALID_APPOINTMENT_DURATIONS, [30, 60, 90]);
  });

  it("defaults to all three when missing or invalid", () => {
    assert.deepEqual(normalizeAppointmentDurations(undefined), [30, 60, 90]);
    assert.deepEqual(normalizeAppointmentDurations(null), [30, 60, 90]);
    assert.deepEqual(normalizeAppointmentDurations([]), [30, 60, 90]);
    assert.deepEqual(normalizeAppointmentDurations([45, 120]), [30, 60, 90]);
  });

  it("normalizes and dedupes valid selections", () => {
    assert.deepEqual(normalizeAppointmentDurations([90, 60, 60]), [60, 90]);
    assert.deepEqual(normalizeAppointmentDurations(["60", "90"]), [60, 90]);
    assert.deepEqual(normalizeAppointmentDurations([30]), [30]);
  });

  it("compares normalized arrays", () => {
    assert.equal(appointmentDurationsEqual([60, 90], [90, 60]), true);
    assert.equal(appointmentDurationsEqual([60], [60, 90]), false);
    assert.equal(appointmentDurationsEqual(undefined, []), true);
  });

  it("parseAppointmentDurationsInput returns null when omitted", () => {
    assert.equal(parseAppointmentDurationsInput(undefined), null);
    assert.equal(parseAppointmentDurationsInput(null), null);
  });

  it("parseAppointmentDurationsInput accepts arrays", () => {
    assert.deepEqual(parseAppointmentDurationsInput([60, 90]), [60, 90]);
  });

  it("parseAppointmentDurationsInput parses JSON strings", () => {
    assert.deepEqual(parseAppointmentDurationsInput("[60,90]"), [60, 90]);
  });

  it("parseAppointmentDurationsInput rejects invalid JSON", () => {
    assert.throws(
      () => parseAppointmentDurationsInput("not-json"),
      /Invalid appointment durations/,
    );
  });

  it("parseAppointmentDurationsInput rejects empty arrays", () => {
    assert.throws(
      () => parseAppointmentDurationsInput([]),
      /Select at least one appointment duration/,
    );
  });

  it("parseAppointmentDurationsInput rejects invalid duration values", () => {
    assert.throws(
      () => parseAppointmentDurationsInput([45]),
      /Invalid appointment durations/,
    );
    assert.throws(
      () => parseAppointmentDurationsInput([60, 45]),
      /Invalid appointment durations/,
    );
  });
});
