/**
 * Rocket.Chat exposes two different notions of “online”:
 * - `status` — user-visible presence.
 * - `statusConnection` — active connection to Rocket.Chat when the REST payload includes it.
 *
 * Many `users.list` responses omit `statusConnection`. In that case we fall back to
 * `status === 'online'` (still RC-scoped: only users returned by the online query).
 * When `statusConnection` is present, we trust it and hide users explicitly `offline`.
 *
 * Product rule: hide the “online” dot when Rocket.Chat has no recent activity signal within
 * {@link RC_ONLINE_MAX_IDLE_MS}. We use the latest of `lastLogin` and `_updatedAt` when both
 * are present (RC may omit `lastLogin` depending on version/permissions). If neither timestamp
 * is present, we keep the user (same as before) so listing still works.
 */
export const RC_ONLINE_MAX_IDLE_MS = 30 * 60 * 1000;

const parseRocketChatDate = (val: unknown): number | null => {
    if (val == null) return null;
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string') {
        const t = Date.parse(val);
        return Number.isNaN(t) ? null : t;
    }
    if (typeof val === 'object' && val !== null && '$date' in (val as object)) {
        const d = (val as { $date: unknown }).$date;
        if (typeof d === 'number' && Number.isFinite(d)) return d;
        if (typeof d === 'string') {
            const t = Date.parse(d);
            return Number.isNaN(t) ? null : t;
        }
    }
    if (val instanceof Date) return val.getTime();
    return null;
};

const lastRocketChatActivityMs = (u: any): number | null => {
    const candidates = [
        parseRocketChatDate(u?.lastLogin),
        parseRocketChatDate(u?._updatedAt),
        parseRocketChatDate(u?.updatedAt),
    ].filter((x): x is number => x != null);
    if (!candidates.length) return null;
    return Math.max(...candidates);
};

const isWithinOnlineIdleWindow = (u: any, nowMs: number, maxIdleMs: number): boolean => {
    const last = lastRocketChatActivityMs(u);
    if (last == null) return true;
    return nowMs - last <= maxIdleMs;
};

export const rcUsernamesWithActiveChatConnection = (
    users: any[],
    nowMs: number = Date.now(),
    maxIdleMs: number = RC_ONLINE_MAX_IDLE_MS
): string[] => {
    const out: string[] = [];
    for (const u of users || []) {
        const uname = String(u?.username || '').trim();
        if (!uname) continue;

        const connRaw = u?.statusConnection;
        const hasConnField =
            connRaw !== undefined &&
            connRaw !== null &&
            String(connRaw).trim() !== '';

        const conn = String(connRaw ?? '').toLowerCase().trim();
        const st = String(u?.status ?? '').toLowerCase().trim();

        if (hasConnField) {
            if (conn === 'online' && isWithinOnlineIdleWindow(u, nowMs, maxIdleMs)) out.push(uname);
            continue;
        }

        if (st === 'online' && isWithinOnlineIdleWindow(u, nowMs, maxIdleMs)) out.push(uname);
    }
    return [...new Set(out)];
};
