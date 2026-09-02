export const VALID_APPOINTMENT_DURATIONS = [30, 60, 90] as const;

export type AppointmentDurationMinutes = (typeof VALID_APPOINTMENT_DURATIONS)[number];

export function normalizeAppointmentDurations(
  raw: unknown,
): AppointmentDurationMinutes[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...VALID_APPOINTMENT_DURATIONS];
  }
  const normalized = [
    ...new Set(
      raw
        .map((value) => Number(value))
        .filter((value): value is AppointmentDurationMinutes =>
          VALID_APPOINTMENT_DURATIONS.includes(value as AppointmentDurationMinutes),
        ),
    ),
  ].sort((a, b) => a - b);
  return normalized.length ? normalized : [...VALID_APPOINTMENT_DURATIONS];
}

export function appointmentDurationsEqual(a: unknown, b: unknown): boolean {
  const left = normalizeAppointmentDurations(a);
  const right = normalizeAppointmentDurations(b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function formatOfferedDurationsList(
  durations: AppointmentDurationMinutes[],
): string {
  return durations.map((duration) => `${duration} min`).join(' / ');
}

/** Lowest duration drives slot-pill preview (most granular sub-intervals). */
export function previewDurationForSlots(
  durations: AppointmentDurationMinutes[],
): AppointmentDurationMinutes {
  if (durations.includes(30)) return 30;
  if (durations.includes(60)) return 60;
  return durations[0] ?? 60;
}

export function defaultAppointmentDuration(
  durations: AppointmentDurationMinutes[],
): AppointmentDurationMinutes {
  return durations[0] ?? 60;
}

export function isAllowedAppointmentDuration(
  duration: number,
  allowed: AppointmentDurationMinutes[],
): duration is AppointmentDurationMinutes {
  return allowed.includes(duration as AppointmentDurationMinutes);
}
