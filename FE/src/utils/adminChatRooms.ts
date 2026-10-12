import type { ChatSection } from './chatSections';

export type AdminRoomKind = 'appointment' | 'seminar' | 'community';

export type AdminSearchRoom = {
    _id: string;
    name: string;
    type: string;
    start?: string | null;
    seriesId?: string | null;
    titleLine?: string;
    isOpenToAll?: boolean;
    host?: { _id?: string; username?: string; email?: string } | null;
    people?: Array<{ _id?: string; username?: string; email?: string }>;
    participantCount?: number;
    joined?: boolean;
};

const text = (value: unknown): string => String(value ?? '').trim();
const idOf = (value: any): string => text(value?._id ?? value?.id ?? value);

export const adminRoomKindForSection = (section: ChatSection): AdminRoomKind | null => {
    if (section === 'appointments') return 'appointment';
    if (section === 'seminars') return 'seminar';
    if (section === 'communities') return 'community';
    return null;
};

export const mergeAdminRooms = (ownGroupChats: any[] | null | undefined, adminRooms: any[] | null | undefined): any[] => {
    const own = Array.isArray(ownGroupChats) ? ownGroupChats : [];
    const extra = Array.isArray(adminRooms) ? adminRooms : [];
    if (!extra.length) return own;
    const seen = new Set(own.map(idOf));
    return [...own, ...extra.filter((room) => !seen.has(idOf(room)))];
};

const personName = (person: any): string => text(person?.username) || text(person?.email);

export const appointmentPeopleLabel = (room: any): string => {
    const people = [...(Array.isArray(room?.participants) ? room.participants : [])];
    const host = room?.admin;
    if (host && !people.some((p) => idOf(p) === idOf(host))) people.push(host);
    const names: string[] = [];
    for (const p of people) {
        const name = personName(p);
        if (name && !names.includes(name)) names.push(name);
    }
    return names.join(' & ');
};

export const adminSearchExtras = (
    results: readonly AdminSearchRoom[] | null | undefined,
    listed: ReadonlyArray<{ _id?: unknown; raw?: any }>,
): AdminSearchRoom[] => {
    const listedIds = new Set<string>();
    const listedSeries = new Set<string>();
    for (const row of listed) {
        const id = idOf(row?._id ?? row?.raw?._id);
        if (id) listedIds.add(id);
        const sid = idOf(row?.raw?.seriesId);
        if (sid) listedSeries.add(sid);
    }
    return (results || []).filter((room) => {
        if (room.joined) return false;
        if (listedIds.has(idOf(room._id))) return false;
        const sid = idOf(room.seriesId);
        return !(sid && listedSeries.has(sid));
    });
};

export const adminSearchSubtitle = (kind: AdminRoomKind, room: AdminSearchRoom): string => {
    if (kind === 'appointment') {
        const names = (room.people || []).map(personName).filter(Boolean);
        const host = personName(room.host);
        if (host && !names.includes(host)) names.push(host);
        return names.length ? names.join(' & ') : '1:1 appointment';
    }
    if (kind === 'seminar') {
        const host = personName(room.host);
        const when = room.start ? new Date(room.start) : null;
        const whenLabel = when && !Number.isNaN(when.getTime())
            ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : '';
        return [host ? `Hosted by ${host}` : '', whenLabel].filter(Boolean).join(' · ') || 'Seminar';
    }
    const visibility = room.isOpenToAll ? 'Open to all' : 'Invite only';
    return [text(room.titleLine), visibility].filter(Boolean).join(' · ');
};

export const ADMIN_ROOMS_CHANGED_EVENT = 'wl-admin-rooms-changed';

export const isChatAdminViewer = (
    groupChat: { chatAdmins?: unknown } | null | undefined,
    viewer: { _id?: unknown; id?: unknown; role?: unknown } | null | undefined,
): boolean => {
    if (!groupChat || text(viewer?.role).toLowerCase() !== 'admin') return false;
    const me = idOf(viewer?._id ?? viewer?.id);
    if (!me) return false;
    const admins = Array.isArray(groupChat.chatAdmins) ? groupChat.chatAdmins : [];
    return admins.some((a) => idOf(a) === me);
};

export const isAdminAuthor = (author: { role?: unknown } | null | undefined): boolean =>
    text(author?.role).toLowerCase() === 'admin';
