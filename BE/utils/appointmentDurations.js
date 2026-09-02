const VALID_APPOINTMENT_DURATIONS = [30, 60, 90];

function normalizeAppointmentDurations(raw) {
  if (!Array.isArray(raw) || !raw.length) {
    return [...VALID_APPOINTMENT_DURATIONS];
  }
  const normalized = [
    ...new Set(
      raw
        .map((value) => Number(value))
        .filter((value) => VALID_APPOINTMENT_DURATIONS.includes(value)),
    ),
  ].sort((a, b) => a - b);
  return normalized.length ? normalized : [...VALID_APPOINTMENT_DURATIONS];
}

function parseAppointmentDurationsInput(raw) {
  if (raw === undefined || raw === null) {
    return null;
  }
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Invalid appointment durations");
    }
  }
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error("Select at least one appointment duration");
  }
  const normalized = normalizeAppointmentDurations(parsed);
  if (normalized.length !== parsed.length) {
    throw new Error("Invalid appointment durations");
  }
  return normalized;
}

function appointmentDurationsEqual(a, b) {
  const left = normalizeAppointmentDurations(a);
  const right = normalizeAppointmentDurations(b);
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

module.exports = {
  VALID_APPOINTMENT_DURATIONS,
  normalizeAppointmentDurations,
  parseAppointmentDurationsInput,
  appointmentDurationsEqual,
};
