// Single source of truth for the seminar "how full is it" label, shown
// identically on the student (browse/detail) and expert (hub card/detail,
// profile) surfaces. "Seats filled + remaining" phrasing:
//   capped, seats left -> "3 of 10 seats filled · 7 left"
//   capped, full       -> "10 of 10 seats filled · Full"
//   no cap set         -> "3 enrolled · no limit"
export function seminarCapacityLabel(
  enrolled: number,
  maxAttendees: number | null | undefined,
): string {
  const filled = Math.max(0, Math.trunc(enrolled) || 0);
  if (typeof maxAttendees === 'number' && maxAttendees > 0) {
    const left = maxAttendees - filled;
    if (left <= 0) {
      return `${filled} of ${maxAttendees} seats filled · Full`;
    }
    return `${filled} of ${maxAttendees} seats filled · ${left} left`;
  }
  return `${filled} enrolled · no limit`;
}
