/**
 * WL Messenger sends Quill HTML (`<p>…</p>`). Rocket.Chat stores `msg` as plain text and does not
 * render HTML in the default client — users would see literal `<p>hello</p>`. Strip to plain text
 * for chat.wisdomlinked.com (and any RC). Meeting / file markers and WL wire formats are left unchanged.
 */
import { isRichHtmlWire } from './chatRichHtmlWire';

export function wlHtmlToPlainTextForRocketChat(raw: string): string {
    const s = String(raw ?? '');
    if (!s.trim()) return '';
    if (s.startsWith('__WL_REPLY__|')) return s;
    if (isRichHtmlWire(s)) return s;
    if (s.startsWith('__MEETING_') || (s.startsWith('__') && s.includes('::'))) return s;
    if (s.startsWith('Chatfile:') || s.startsWith('Call Lasted for:') || s.startsWith('Seminar Lasted for:')) {
        return s;
    }
    return s
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
