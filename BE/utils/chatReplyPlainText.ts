import { wlHtmlToPlainTextForRocketChat } from './wlHtmlPlainText';
import { encodeRichHtmlWire, hasRichHtmlMarkup } from './chatRichHtmlWire';

export const WL_REPLY_WIRE_PREFIX = '__WL_REPLY__';

export type PeeledHtmlReplyQuote = {
    to: string;
    excerpt: string;
    messageId?: string;
};

/** Peel leading WisdomLinked reply blockquotes from outbound HTML (regex-only for Node). */
export function peelHtmlReplyQuotesRegex(html: string): {
    quotes: PeeledHtmlReplyQuote[];
    bodyHtml: string;
} {
    const quotes: PeeledHtmlReplyQuote[] = [];
    let remaining = String(html ?? '').trim();
    const re =
        /^<blockquote([^>]*)>\s*<strong>\s*Replying to\s+([^<]+)<\/strong>\s*<br\s*\/?>\s*([\s\S]*?)<\/blockquote>/i;

    for (let i = 0; i < 12; i++) {
        const m = remaining.match(re);
        if (!m) break;
        const attrs = m[1] || '';
        const idMatch = /data-wl-reply-id\s*=\s*["']([^"']+)["']/i.exec(attrs);
        const messageId = idMatch ? idMatch[1].trim() : undefined;
        const to = m[2]
            .trim()
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
        const excerpt = m[3]
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        quotes.push({ to, excerpt, messageId });
        remaining = remaining.slice(m[0].length).trim();
    }
    return { quotes, bodyHtml: remaining };
}

function encodeWireField(value: string): string {
    return encodeURIComponent(String(value || '').trim());
}

/** Build RC-safe plain text for a reply (survives wlHtmlToPlainText stripping). */
export function encodeReplyWireFormat(quote: PeeledHtmlReplyQuote, bodyPlain: string): string {
    const messageId = String(quote.messageId || '').trim() || 'unknown';
    const author = encodeWireField(quote.to);
    const excerpt = encodeWireField(quote.excerpt);
    const body = String(bodyPlain || '').trim();
    return `${WL_REPLY_WIRE_PREFIX}|${messageId}|${author}|${excerpt}|\n${body}`;
}

/** Encode reply body for RC: rich HTML uses __WL_HTML__ wire; plain uses stripped text. */
function encodeReplyBodyForRocketChat(bodyHtml: string): string {
    const raw = String(bodyHtml ?? '').trim();
    if (!raw) return '';
    if (hasRichHtmlMarkup(raw)) return encodeRichHtmlWire(raw);
    return wlHtmlToPlainTextForRocketChat(raw);
}

/**
 * Convert outbound messenger HTML for Rocket.Chat storage.
 * Replies become __WL_REPLY__ wire lines; rich text uses __WL_HTML__ wire; else plain.
 */
export function prepareMessageForRocketChat(html: string): string {
    const raw = String(html ?? '').trim();
    if (!raw) return '';
    if (raw.startsWith(`${WL_REPLY_WIRE_PREFIX}|`)) return raw;

    const { quotes, bodyHtml } = peelHtmlReplyQuotesRegex(raw);
    if (!quotes.length) {
        if (hasRichHtmlMarkup(raw)) return encodeRichHtmlWire(raw);
        return wlHtmlToPlainTextForRocketChat(raw);
    }

    const quote = quotes[quotes.length - 1];
    const bodyStored = encodeReplyBodyForRocketChat(bodyHtml || '');
    return encodeReplyWireFormat(quote, bodyStored);
}
