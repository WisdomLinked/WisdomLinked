export type AdminRoomKind = 'appointment' | 'seminar' | 'community';

const idOf = (value: unknown): string => {
    if (value == null) return '';
    const maybe = value as { _id?: unknown };
    return String(maybe?._id ?? value).trim();
};

export const isPlatformAdmin = (user: { role?: unknown } | null | undefined): boolean =>
    String(user?.role ?? '').toLowerCase() === 'admin';

export const isChatAdminOf = (
    groupChat: { chatAdmins?: unknown } | null | undefined,
    user: { role?: unknown; _id?: unknown; userId?: unknown } | null | undefined,
): boolean => {
    if (!groupChat || !isPlatformAdmin(user)) return false;
    const me = idOf(user?.userId ?? user?._id);
    if (!me) return false;
    const admins = Array.isArray(groupChat.chatAdmins) ? groupChat.chatAdmins : [];
    return admins.map(idOf).includes(me);
};

export const isGroupParticipant = (
    groupChat: { participants?: unknown } | null | undefined,
    userId: unknown,
): boolean => {
    const me = idOf(userId);
    if (!me || !groupChat) return false;
    const people = Array.isArray(groupChat.participants) ? groupChat.participants : [];
    return people.map(idOf).includes(me);
};

export const canUseGroupChat = (
    groupChat: { participants?: unknown; chatAdmins?: unknown } | null | undefined,
    user: { role?: unknown; _id?: unknown; userId?: unknown } | null | undefined,
): boolean =>
    isGroupParticipant(groupChat, user?.userId ?? user?._id) || isChatAdminOf(groupChat, user);

export const ADMIN_ROOM_TYPE: Record<AdminRoomKind, 'individual' | 'seminar' | 'community'> = {
    appointment: 'individual',
    seminar: 'seminar',
    community: 'community',
};

export const parseAdminRoomKind = (value: unknown): AdminRoomKind | null => {
    const v = String(value ?? '').trim().toLowerCase();
    return v === 'appointment' || v === 'seminar' || v === 'community' ? v : null;
};

export const adminRoomBaseFilter = (kind: AdminRoomKind): Record<string, unknown> => ({
    type: ADMIN_ROOM_TYPE[kind],
    status: 'active',
});

export const ADMIN_ROOM_QUERY_MAX = 80;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const adminRoomNameFilter = (query: unknown): Record<string, unknown> | null => {
    const q = String(query ?? '').trim().slice(0, ADMIN_ROOM_QUERY_MAX);
    if (!q) return null;
    return { name: { $regex: escapeRegExp(q), $options: 'i' } };
};

export const collapseSeriesRooms = <T extends { _id?: unknown; seriesId?: unknown; start?: unknown }>(
    rooms: readonly T[],
    now: number = Date.now(),
): T[] => {
    const bySeries = new Map<string, T[]>();
    const out: T[] = [];
    for (const room of rooms) {
        const sid = idOf(room.seriesId);
        if (!sid) {
            out.push(room);
            continue;
        }
        const list = bySeries.get(sid);
        if (list) list.push(room);
        else {
            bySeries.set(sid, [room]);
            out.push(room);
        }
    }
    return out.map((room) => {
        const sid = idOf(room.seriesId);
        const list = sid ? bySeries.get(sid) : undefined;
        if (!list || list.length < 2) return room;
        const startMs = (r: T) => {
            const t = new Date(r.start as any).getTime();
            return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
        };
        const upcoming = list.filter((r) => startMs(r) >= now).sort((a, b) => startMs(a) - startMs(b));
        if (upcoming.length) return upcoming[0];
        return [...list].sort((a, b) => startMs(b) - startMs(a))[0];
    });
};
