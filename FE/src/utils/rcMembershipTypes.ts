/**
 * Rocket.Chat membership / subscription message `t` values (see MessageTypes.ts).
 * Installations differ: some emit `uj`/`ul`, others `au`/`ru`, etc.
 */

const RC_JOIN_TYPES = new Set([
    'uj',
    'ujt',
    'au',
    'ui',
    'ut',
    'added-user-to-team',
    'user-added-room-to-team',
]);

const RC_LEAVE_TYPES = new Set([
    'ul',
    'ult',
    'ru',
    'removed-user-from-team',
    'user-removed-room-from-team',
    'user-deleted-room-from-team',
]);

/** `join` | `leave` when this is a membership system row; otherwise `null`. */
export function canonicalMembershipSide(t: string | null | undefined): 'join' | 'leave' | null {
    const x = String(t ?? '')
        .trim()
        .toLowerCase();
    if (!x) return null;
    if (RC_JOIN_TYPES.has(x)) return 'join';
    if (RC_LEAVE_TYPES.has(x)) return 'leave';
    return null;
}

/** Stable labels stored on messages for display rewrite (`uj` / `ul` only). */
export function wlRcSubtypeFromRocketType(t: string | null | undefined): 'uj' | 'ul' | undefined {
    const s = canonicalMembershipSide(t);
    if (s === 'join') return 'uj';
    if (s === 'leave') return 'ul';
    return undefined;
}
