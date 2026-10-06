export const GROUP_SEEN_MEMBER_CAP = 25;

export function isGroupSeenTrackable(
    otherMemberCount: number,
    cap: number = GROUP_SEEN_MEMBER_CAP,
): boolean {
    return otherMemberCount > 0 && otherMemberCount <= cap;
}

export function resolveRoomSeenMs(lastSeenMsByMember: Array<number | null | undefined>): number | null {
    if (!Array.isArray(lastSeenMsByMember) || lastSeenMsByMember.length === 0) return null;

    let earliest: number | null = null;
    for (const raw of lastSeenMsByMember) {
        if (raw == null || typeof raw !== 'number' || Number.isNaN(raw)) return null;
        if (earliest == null || raw < earliest) earliest = raw;
    }
    return earliest;
}

export function distinctMemberIds(memberIds: Array<string | null | undefined>): string[] {
    if (!Array.isArray(memberIds)) return [];
    return [...new Set(memberIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
}

/**
 * Lines up stored read rows against the members we need an answer for.
 *
 * Returns one entry per member, in the order given, so the result can go straight into
 * {@link resolveRoomSeenMs}. A member with no stored row has never opened the room as far as
 * we know, and reports null — which correctly stops the room reading as fully seen rather
 * than silently leaving that person out of the calculation.
 */
export function lastReadMsForMembers(
    rows: Array<{ userId?: unknown; lastReadAt?: Date | string | number | null }>,
    memberIds: string[],
): Array<number | null> {
    const byUser = new Map<string, number>();
    for (const row of Array.isArray(rows) ? rows : []) {
        const uid = String((row?.userId as any)?._id ?? row?.userId ?? '').trim();
        if (!uid) continue;
        const ms = new Date(row?.lastReadAt ?? NaN).getTime();
        if (Number.isNaN(ms)) continue;
        const existing = byUser.get(uid);
        if (existing == null || ms > existing) byUser.set(uid, ms);
    }
    return (Array.isArray(memberIds) ? memberIds : []).map((id) => {
        const ms = byUser.get(String(id).trim());
        return ms == null ? null : ms;
    });
}
