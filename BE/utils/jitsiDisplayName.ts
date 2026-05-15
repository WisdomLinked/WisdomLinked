import { wlDisplayName } from './wlDisplayName';

/**
 * Short label for Jitsi / Excalidraw cursors (initials, not full display name).
 */
export function jitsiDisplayInitials(
    user: { username?: string; email?: string; name?: string } | null | undefined,
): string {
    const label = wlDisplayName(user) || String(user?.name || '').trim() || 'Guest';
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        const a = parts[0].charAt(0);
        const b = parts[parts.length - 1].charAt(0);
        return `${a}${b}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0]?.charAt(0) || 'G').toUpperCase();
}
