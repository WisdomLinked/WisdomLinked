export const WL_HTML_WIRE_PREFIX = '__WL_HTML__';

const RICH_MARKUP_RE =
    /<(strong|em|u|s|b|i|span|h[1-6]|ul|ol|li|blockquote|pre|code|a)\b/i;

/**
 * Preserve Quill HTML for Rocket.Chat storage unless it is a single plain-text paragraph.
 * Lists, multi-paragraph breaks, line breaks, and Quill layout classes all qualify.
 */
export function hasRichHtmlMarkup(html: string): boolean {
    const raw = String(html ?? '').trim();
    if (!raw || raw === '<p><br></p>') return false;
    if (RICH_MARKUP_RE.test(raw)) return true;
    if (/(<\/p>\s*<p|<br\s*\/?>)/i.test(raw)) return true;
    if (/\bql-(indent|align|syntax)\b/i.test(raw)) return true;
    return false;
}

export function encodeRichHtmlWire(html: string): string {
    const raw = String(html ?? '').trim();
    if (!raw) return '';
    return `${WL_HTML_WIRE_PREFIX}|${encodeURIComponent(raw)}`;
}

export function isRichHtmlWire(content: string): boolean {
    return String(content ?? '').trim().startsWith(`${WL_HTML_WIRE_PREFIX}|`);
}

export function decodeRichHtmlWire(content: string): string | null {
    const raw = String(content ?? '').trim();
    if (!isRichHtmlWire(raw)) return null;
    const encoded = raw.slice(WL_HTML_WIRE_PREFIX.length + 1);
    try {
        return decodeURIComponent(encoded);
    } catch {
        return null;
    }
}
