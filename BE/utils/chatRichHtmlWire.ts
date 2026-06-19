export const WL_HTML_WIRE_PREFIX = '__WL_HTML__';

const RICH_MARKUP_RE =
    /<(strong|em|u|s|b|i|span|h[1-6]|ul|ol|li|blockquote|pre|code|a)\b/i;

/** True when Quill HTML includes formatting beyond a single plain paragraph. */
export function hasRichHtmlMarkup(html: string): boolean {
    const raw = String(html ?? '').trim();
    if (!raw || raw === '<p><br></p>') return false;
    return RICH_MARKUP_RE.test(raw);
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
