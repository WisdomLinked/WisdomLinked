const GROUP_ROOM_NAME = /^wl-group-([0-9a-f]{24})$/i;
const MACHINE_USERNAME = /^(u_)?[a-z0-9._-]+_[a-z0-9.-]+_[a-z]{2,}$/i;

export const isMachineRoomLabel = (label: string | undefined | null): boolean => {
  const value = String(label || '').trim();
  if (!value) return true;
  if (GROUP_ROOM_NAME.test(value)) return true;
  if (/^wl[-_]/i.test(value)) return true;
  if (/\s/.test(value)) return false;
  return MACHINE_USERNAME.test(value);
};

export const looksLikeWlRoomName = (label: string | undefined | null): boolean => {
  const value = String(label || '').trim().toLowerCase();
  if (!value) return false;
  return value.startsWith('wl-group-') || value.startsWith('wl_') || value.includes('community');
};

export const shouldNotifyRoom = (
  rid: string,
  knownRids: Set<string>,
  rawRoomName: string | undefined | null,
  resolutionFailed: boolean,
): boolean => {
  if (knownRids.has(String(rid))) return true;
  return resolutionFailed && looksLikeWlRoomName(rawRoomName);
};

export const displayRoomLabel = (
  label: string | undefined | null,
  fallback: string,
): string => {
  const value = String(label || '').trim();
  return value && !isMachineRoomLabel(value) ? value : fallback;
};
