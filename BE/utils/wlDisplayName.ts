/**
 * Human-readable label for chat UI when `username` is missing or stored as an email.
 */
export function wlDisplayName(user: { username?: string; email?: string } | null | undefined): string {
    if (!user) return 'Someone';
    const raw = String(user.username ?? '').trim();
    if (raw && !raw.includes('@')) return raw;
    const email = String(user.email ?? '').trim();
    if (email) {
        const local = email.split('@')[0];
        return local
            .replace(/[._-]+/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    }
    return raw || 'Someone';
}
