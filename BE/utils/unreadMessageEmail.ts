export const UNREAD_EMAIL_IDLE_MS = 6 * 60 * 60 * 1000;

export const CHAT_SEEN_THROTTLE_MS = 60 * 1000;

/** How long a check that could not reach Rocket.Chat waits before it is tried again. */
export const UNREAD_EMAIL_RETRY_MS = 60 * 60 * 1000;

export const UNREAD_EMAIL_ROLES = ['customer', 'expert'];

export type UnreadEmailState = {
    chatLastSeenAt?: any;
    sentAt?: any;
    checkedAt?: any;
    countdownFrom?: any;
    failedAt?: any;
};

export type UnreadEmailDecision =
    | { action: 'wait' }
    | { action: 'startCountdown'; fromMs: number }
    | { action: 'check' };

const toMs = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
};

const WAIT: UnreadEmailDecision = { action: 'wait' };
const CHECK: UnreadEmailDecision = { action: 'check' };

/**
 * For `retryMs` after a check that could not reach Rocket.Chat, nothing is checked. After that the
 * check runs again without waiting for a new message: the unread messages that made it due are still
 * there. (A failure from before the latest visit, check or email is always older than `retryMs`,
 * because a check only becomes due `idleMs` after a visit and is never retried sooner.)
 */
export const decideUnreadEmail = ({
    state,
    activity,
    now,
    activatedAt,
    idleMs = UNREAD_EMAIL_IDLE_MS,
    retryMs = UNREAD_EMAIL_RETRY_MS,
}: {
    state: UnreadEmailState | null | undefined;
    activity: any[];
    now: number;
    activatedAt: number;
    idleMs?: number;
    retryMs?: number;
}): UnreadEmailDecision => {
    const failed = toMs(state?.failedAt);
    if (failed !== null && now - failed < retryMs) return WAIT;
    return decideIgnoringFailures({ state, activity, now, activatedAt, idleMs });
};

const decideIgnoringFailures = ({
    state,
    activity,
    now,
    activatedAt,
    idleMs,
}: {
    state: UnreadEmailState | null | undefined;
    activity: any[];
    now: number;
    activatedAt: number;
    idleMs: number;
}): UnreadEmailDecision => {
    const lastSeen = toMs(state?.chatLastSeenAt);
    const absenceStart = Math.max(lastSeen ?? activatedAt, activatedAt);
    if (now - absenceStart < idleMs) return WAIT;

    const activityMs = (activity || [])
        .map(toMs)
        .filter((ms): ms is number => ms !== null);

    const thisAbsence = (value: any): number | null => {
        const ms = toMs(value);
        return ms !== null && ms >= absenceStart ? ms : null;
    };
    const sent = thisAbsence(state?.sentAt);
    const checked = thisAbsence(state?.checkedAt);

    if (sent === null) {
        if (checked === null) return activityMs.length ? CHECK : WAIT;
        return activityMs.some((ms) => ms > checked) ? CHECK : WAIT;
    }

    const floor = Math.max(sent, checked ?? sent);
    const countdown = toMs(state?.countdownFrom);
    if (countdown !== null && countdown > floor) {
        return now - countdown >= idleMs ? CHECK : WAIT;
    }

    const newer = activityMs.filter((ms) => ms > floor);
    if (!newer.length) return WAIT;
    const fromMs = Math.min(...newer);
    return now - fromMs >= idleMs ? CHECK : { action: 'startCountdown', fromMs };
};

type GroupChatLike = { rcChannelId?: unknown; type?: unknown; status?: unknown } | null | undefined;

const asRid = (value: unknown): string => String(value ?? '').trim();

export const countableRoomIds = (
    dmRids: unknown[] | null | undefined,
    groupChats: GroupChatLike[] | null | undefined,
): Set<string> => {
    const out = new Set<string>();
    (dmRids || []).forEach((raw) => {
        const rid = asRid(raw);
        if (rid) out.add(rid);
    });
    (groupChats || []).forEach((chat) => {
        const rid = asRid(chat?.rcChannelId);
        if (!rid) return;
        const type = asRid(chat?.type).toLowerCase();
        const status = asRid(chat?.status).toLowerCase();
        if (type === 'seminar' || type === 'community' || (type === 'individual' && status === 'active')) {
            out.add(rid);
        }
    });
    return out;
};

export const totalUnread = (
    unreadByRid: Record<string, unknown> | null | undefined,
    countable: Set<string>,
): number => {
    let total = 0;
    Object.entries(unreadByRid || {}).forEach(([rid, n]) => {
        if (!countable.has(String(rid))) return;
        const count = Number(n);
        if (Number.isFinite(count) && count > 0) total += count;
    });
    return total;
};

export const isUnreadEmailRecipient = (user: any): boolean => {
    if (!user?.email) return false;
    if (!UNREAD_EMAIL_ROLES.includes(String(user.role || ''))) return false;
    if (user.status === 'blocked') return false;
    return user?.notificationPreferences?.email !== false;
};
