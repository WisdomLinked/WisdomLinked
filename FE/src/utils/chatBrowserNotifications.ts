/** Desktop notifications for new chat messages (requires user permission). */

export async function ensureChatNotificationsEnabled(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
        const p = await Notification.requestPermission();
        return p === 'granted';
    } catch {
        return false;
    }
}

export function notifyChatMessage(
    title: string,
    body: string,
    tag?: string,
    options?: { allowWhenVisible?: boolean }
) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!options?.allowWhenVisible && document.visibilityState === 'visible') return;
    try {
        new Notification(title, {
            body: body.slice(0, 180),
            tag: tag || 'wl-chat',
        });
    } catch {
        /* ignore */
    }
}

export function stripChatHtml(html: string): string {
    if (!html) return '';
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
