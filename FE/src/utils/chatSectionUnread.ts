import { ChatNavTarget } from './chatNavTarget';
import { sectionForChatTarget } from './chatSections';

/** Unread totals keyed by ChatSection id, holding only sections that have any. */
export type ChatSectionUnreadMap = Record<string, number>;

/**
 * Splits the flat per-room unread counts across the Chat dropdown's sections, so the
 * sidebar can say *where* the unread messages are rather than only how many there are.
 *
 * Rooms with no known target are skipped: no list can open them, so no section can
 * honestly claim them. Callers pass the same already-filtered map the Chat badge totals,
 * which keeps the sections summing to exactly that badge.
 */
export function unreadByChatSection(
    unreadByRid: Record<string, number> | null | undefined,
    targetByRid: Record<string, ChatNavTarget> | null | undefined,
): ChatSectionUnreadMap {
    const out: ChatSectionUnreadMap = {};

    Object.entries(unreadByRid || {}).forEach(([rid, raw]) => {
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) return;

        const target = targetByRid?.[String(rid).trim()];
        if (!target) return;

        const section = sectionForChatTarget(target);
        out[section] = (out[section] || 0) + Math.floor(n);
    });

    return out;
}
