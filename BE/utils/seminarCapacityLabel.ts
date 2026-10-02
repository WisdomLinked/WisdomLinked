// Same label strings as FE/src/utils/seminarCapacityLabel.ts.
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
