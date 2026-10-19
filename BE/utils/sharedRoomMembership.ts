import { distinctMemberIds } from './readReceipts';
import { isChatAdminOf } from './adminChatAccess';

type RoomGroupChat = {
    admin?: unknown;
    participants?: unknown;
    coModerators?: unknown;
    chatAdmins?: unknown;
} | null | undefined;

const idOf = (value: any): string => String(value?._id ?? value?.id ?? value ?? '').trim();
const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * Members of one Rocket.Chat room, given every GroupChat that points at it.
 *
 * All occurrences of a recurring seminar share the series room, but a student who registers
 * mid-series is only added to the occurrences from then on. The room itself is built from the
 * union across the series (syncGroupRocketChannel), so membership must be read the same way —
 * any single occurrence can leave out people who are genuinely in the room.
 */
export function sharedRoomMemberIds(groupChats: readonly RoomGroupChat[] | null | undefined): string[] {
    const ids: string[] = [];
    for (const chat of Array.isArray(groupChats) ? groupChats : []) {
        if (!chat) continue;
        ids.push(idOf(chat.admin));
        listOf(chat.participants).forEach((p) => ids.push(idOf(p)));
        listOf(chat.coModerators).forEach((p) => ids.push(idOf(p)));
    }
    return distinctMemberIds(ids);
}

export function canAccessSharedRoom(
    groupChats: readonly RoomGroupChat[] | null | undefined,
    viewer: { userId?: unknown; role?: unknown } | null | undefined,
): boolean {
    if (sharedRoomMemberIds(groupChats).includes(idOf(viewer?.userId))) return true;
    return (Array.isArray(groupChats) ? groupChats : []).some((chat) => isChatAdminOf(chat as any, viewer as any));
}
