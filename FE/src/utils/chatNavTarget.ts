/** Which chat list can open a given Rocket.Chat room. */
export type ChatNavTarget = 'dm' | 'seminar' | 'community';

type GroupChatLike = { rcChannelId?: unknown; type?: unknown } | null | undefined;

/** Both Set and Array expose forEach, which avoids needing downlevelIteration. */
type RidList = { forEach(fn: (rid: string) => void): void } | null | undefined;

const asRid = (value: unknown): string => String(value ?? '').trim();

export function chatTargetsByRid(
    dmRids: RidList,
    groupChats: GroupChatLike[] | null | undefined,
    communityRids: RidList,
): Record<string, ChatNavTarget> {
    const out: Record<string, ChatNavTarget> = {};

    dmRids?.forEach(raw => {
        const rid = asRid(raw);
        if (rid) out[rid] = 'dm';
    });

    (groupChats || []).forEach(chat => {
        const rid = asRid(chat?.rcChannelId);
        if (!rid || out[rid]) return;
        const type = String(chat?.type ?? '').toLowerCase();
        if (type === 'seminar') out[rid] = 'seminar';
        else if (type === 'community') out[rid] = 'community';
    });

    communityRids?.forEach(raw => {
        const rid = asRid(raw);
        if (rid && !out[rid]) out[rid] = 'community';
    });

    return out;
}
