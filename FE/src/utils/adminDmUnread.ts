import { chatTargetsByRid } from './chatNavTarget';
import { unreadByChatSection, type ChatSectionUnreadMap } from './chatSectionUnread';

type ConversationLike = { rcChannelId?: unknown } | null | undefined;

export type AdminDmUnread = { total: number; bySection: ChatSectionUnreadMap };

export function adminDmUnread(
    directConversations: ConversationLike[] | null | undefined,
    unreadByRid: Record<string, number> | null | undefined,
): AdminDmUnread {
    const dmRids = (directConversations || []).map(conv => String(conv?.rcChannelId ?? ''));
    const bySection = unreadByChatSection(unreadByRid, chatTargetsByRid(dmRids, [], []));
    const total = Object.values(bySection).reduce((sum, n) => sum + n, 0);
    return { total, bySection };
}

export function isUnknownDmRoom(
    directConversations: ConversationLike[] | null | undefined,
    rid: unknown,
): boolean {
    const id = String(rid ?? '').trim();
    if (!id) return false;
    return !(directConversations || []).some(conv => String(conv?.rcChannelId ?? '').trim() === id);
}
