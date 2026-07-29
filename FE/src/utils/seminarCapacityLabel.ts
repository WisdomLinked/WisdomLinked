// Single source of truth for the seminar "how full is it" label, shown
// identically on the student (browse/detail) and expert (hub card/detail,
// profile) surfaces. "Seats filled + remaining" phrasing:
//   capped, seats left -> "3 of 10 seats filled · 7 left"
//   capped, full       -> "10 of 10 seats filled · Full"
//   no cap set         -> "3 enrolled · no limit"
export function seminarCapacityLabel(
  enrolled: number,
  maxAttendees: number | null | undefined,
  options?: { omitFullWord?: boolean },
): string {
  const filled = Math.max(0, Math.trunc(enrolled) || 0);
  if (typeof maxAttendees === 'number') {
    const cap = Math.max(0, Math.trunc(maxAttendees));
    const left = cap - filled;
    if (left <= 0) {
      return options?.omitFullWord
        ? `${filled} of ${cap} seats filled`
        : `${filled} of ${cap} seats filled · Full`;
    }
    return `${filled} of ${cap} seats filled · ${left} left`;
  }
  return `${filled} enrolled · no limit`;
}

export function seminarEnrollmentLabel(
  enrolled: number,
  waiting: number,
  maxAttendees: number | null | undefined,
): string {
  const e = Math.max(0, Math.trunc(enrolled) || 0);
  const w = Math.max(0, Math.trunc(waiting) || 0);
  const cap =
    typeof maxAttendees === 'number' ? String(Math.max(0, Math.trunc(maxAttendees))) : '∞';
  return `Enrollments/waiting/Cap (${e}/${w}/${cap})`;
}
