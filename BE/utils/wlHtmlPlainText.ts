/**
 * WL Messenger sends Quill HTML (`<p>…</p>`). Rocket.Chat stores `msg` as plain text and does not
 * render HTML in the default client — users would see literal `<p>hello</p>`. Strip to plain text
 * for chat.wisdomlinked.com (and any RC). Meeting / file markers and WL wire formats are left unchanged.
 */
import { isRichHtmlWire } from './chatRichHtmlWire';


const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };

export function stripTags(value: string): string {
    let out = String(value ?? '');
    let previous: string;
    do {
        previous = out;
        out = out.replace(/<[^<>]*>/g, '');
    } while (out !== previous);
    return out;
}

export function decodeBasicEntities(value: string): string {
    return String(value ?? '').replace(
        /&(amp|lt|gt|quot|apos|#39|nbsp);/gi,
        (_match, name) => ENTITIES[String(name).toLowerCase()] ?? _match,
    );
}

export function wlHtmlToPlainTextForRocketChat(raw: string): string {
    const s = String(raw ?? '');
    if (!s.trim()) return '';
    if (s.startsWith('__WL_REPLY__|')) return s;
    if (isRichHtmlWire(s)) return s;
    if (s.startsWith('__MEETING_') || (s.startsWith('__') && s.includes('::'))) return s;
    if (s.startsWith('Chatfile:') || s.startsWith('Call Lasted for:') || s.startsWith('Seminar Lasted for:')) {
        return s;
    }
    const withBreaks = s
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n');
    return decodeBasicEntities(stripTags(withBreaks))
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
