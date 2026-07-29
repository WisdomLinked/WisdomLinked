const GROUP_ROOM_NAME = /^wl-group-([0-9a-f]{24})$/i;
const MACHINE_USERNAME = /^(u_)?[a-z0-9._-]+_[a-z0-9.-]+_[a-z]{2,}$/i;

export const parseGroupChatIdFromRoomName = (roomName: string | undefined | null): string | null => {
    const match = GROUP_ROOM_NAME.exec(String(roomName || '').trim());
    return match ? match[1].toLowerCase() : null;
};

export const isMachineRoomLabel = (label: string | undefined | null): boolean => {
    const value = String(label || '').trim();
    if (!value) return true;
    if (GROUP_ROOM_NAME.test(value)) return true;
    if (/^wl[-_]/i.test(value)) return true;
    if (/\s/.test(value)) return false;
    return MACHINE_USERNAME.test(value);
};

export const pickRoomDisplayLabel = (
    resolved: string | undefined | null,
    rawRoomName: string | undefined | null,
    fallback: string,
): string => {
    const human = String(resolved || '').trim();
    if (human && !isMachineRoomLabel(human)) return human;
    const raw = String(rawRoomName || '').trim();
    if (raw && !isMachineRoomLabel(raw)) return raw;
    return fallback;
};
