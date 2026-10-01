export type AppointmentChatRow = {
    _id: string;
    name: string;
    withName: string;
    withImage?: string | null;
    withUserId?: string;
    rcChannelId?: string;
    raw: any;
};

const text = (value: unknown): string => String(value ?? '').trim();

const idOf = (value: any): string => text(value?._id ?? value?.id ?? value);

export const isChatableAppointment = (groupChat: any): boolean =>
    text(groupChat?.type).toLowerCase() === 'individual'
    && text(groupChat?.status).toLowerCase() === 'active';

export const appointmentCounterpart = (groupChat: any, currentUserId: unknown): any => {
    const me = idOf(currentUserId);
    const people = Array.isArray(groupChat?.participants) ? [...groupChat.participants] : [];
    const admin = groupChat?.admin;
    if (admin && !people.some((p: any) => idOf(p) === idOf(admin))) people.push(admin);
    return people.find((p: any) => {
        const id = idOf(p);
        return id && id !== me;
    }) ?? null;
};

export const appointmentPersonName = (person: any): string =>
    text(person?.username) || text(person?.email) || '';

export const appointmentChatRows = (
    groupChats: any[] | null | undefined,
    currentUserId: unknown,
): AppointmentChatRow[] => {
    const rows: AppointmentChatRow[] = [];
    const seen = new Set<string>();
    for (const chat of groupChats || []) {
        if (!isChatableAppointment(chat)) continue;
        const id = idOf(chat);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const other = appointmentCounterpart(chat, currentUserId);
        rows.push({
            _id: id,
            name: text(chat?.name) || '1:1 Appointment',
            withName: appointmentPersonName(other),
            withImage: other?.image ?? null,
            withUserId: idOf(other) || undefined,
            rcChannelId: text(chat?.rcChannelId) || undefined,
            raw: chat,
        });
    }
    return rows;
};

export const matchesAppointmentQuery = (row: AppointmentChatRow, query: string): boolean => {
    const q = text(query).toLowerCase();
    if (!q) return true;
    return row.name.toLowerCase().includes(q) || row.withName.toLowerCase().includes(q);
};
