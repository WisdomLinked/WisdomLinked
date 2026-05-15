/**
 * WisdomLinked thread replies are sent as
 * `<blockquote data-wl-reply-id="…"><strong>Replying to Name</strong><br>excerpt</blockquote>` + body.
 * This module peels those into structured data for layout, and flattens text for the next excerpt.
 */

export type PeeledReplyQuote = {
  to: string;
  excerpt: string;
  messageId?: string;
};

export type ReplyQuotePayload = {
  messageId: string;
  authorName: string;
  excerpt: string;
};

/** Direct parent in a reply chain (last blockquote before body). */
export function immediateReplyQuote(quotes: PeeledReplyQuote[]): PeeledReplyQuote | null {
  if (!quotes.length) return null;
  return quotes[quotes.length - 1];
}

function escapeHtmlAttr(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Outbound HTML for a reply (values in excerpt/author must already be HTML-escaped if needed). */
export function buildReplyQuoteHtml(params: {
  messageId: string;
  authorNameEscaped: string;
  excerptEscaped: string;
}): string {
  const mid = escapeHtmlAttr(params.messageId);
  return `<blockquote class="wl-reply-quote" data-wl-reply-id="${mid}"><strong>Replying to ${params.authorNameEscaped}</strong><br>${params.excerptEscaped}</blockquote>`;
}

function readReplyIdFromBlockquote(el: Element): string | undefined {
  const raw = el.getAttribute("data-wl-reply-id");
  const id = String(raw || "").trim();
  return id || undefined;
}

function skipLeadingEmptyNodes(container: HTMLElement): Element | null {
  let guard = 0;
  while (guard++ < 20) {
    const first = container.firstElementChild;
    if (!first) return null;
    const tag = first.tagName.toLowerCase();
    const text = (first.textContent || "").replace(/\s+/g, "").trim();
    if ((tag === "p" || tag === "div") && !text) {
      first.remove();
      continue;
    }
    return first;
  }
  return null;
}

/** Match WisdomLinked reply blockquotes (with optional data-wl-reply-id). */
export function peelWisdomLinkedReplyQuotes(html: string): {
  quotes: PeeledReplyQuote[];
  bodyHtml: string;
} {
  const quotes: PeeledReplyQuote[] = [];
  let remaining = String(html ?? "").trim();
  if (!remaining) return { quotes, bodyHtml: "" };

  if (typeof document === "undefined") {
    return peelWisdomLinkedReplyQuotesRegex(remaining);
  }

  const doc = document.implementation.createHTMLDocument("");
  const wrapEl = doc.createElement("div");
  const maxPeels = 12;

  for (let i = 0; i < maxPeels; i++) {
    wrapEl.innerHTML = remaining;
    const first = skipLeadingEmptyNodes(wrapEl);
    if (!first || first.tagName.toLowerCase() !== "blockquote") break;

    const strongEls = first.querySelectorAll("strong");
    let to = "";
    for (const s of Array.from(strongEls)) {
      const t = (s.textContent || "").trim();
      const m = /^Replying to\s+(.+)$/i.exec(t);
      if (m) {
        to = m[1].trim();
        break;
      }
    }
    if (!to) break;

    const excerptRoot = first.cloneNode(true) as HTMLElement;
    excerptRoot.querySelectorAll("strong").forEach((s) => {
      if (/^Replying to\s+/i.test((s.textContent || "").trim())) s.remove();
    });
    const excerpt = (excerptRoot.textContent || "").replace(/\s+/g, " ").trim();
    const messageId = readReplyIdFromBlockquote(first);

    quotes.push({ to, excerpt, messageId });
    first.remove();
    remaining = wrapEl.innerHTML.trim();
    if (!remaining) break;
  }

  return { quotes, bodyHtml: remaining };
}

/** Fallback when `document` is unavailable (SSR / tests). */
export function peelWisdomLinkedReplyQuotesRegex(html: string): {
  quotes: PeeledReplyQuote[];
  bodyHtml: string;
} {
  const quotes: PeeledReplyQuote[] = [];
  let remaining = String(html ?? "").trim();
  const re =
    /^<blockquote([^>]*)>\s*<strong>\s*Replying to\s+([^<]+)<\/strong>\s*<br\s*\/?>\s*([\s\S]*?)<\/blockquote>/i;

  for (let i = 0; i < 12; i++) {
    const m = remaining.match(re);
    if (!m) break;
    const attrs = m[1] || "";
    const idMatch = /data-wl-reply-id\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const messageId = idMatch ? idMatch[1].trim() : undefined;
    const to = m[2].trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const excerpt = m[3]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    quotes.push({ to, excerpt, messageId });
    remaining = remaining.slice(m[0].length).trim();
  }
  return { quotes, bodyHtml: remaining };
}

/**
 * Strip reply blockquotes and tags before embedding an excerpt in the next send.
 */
export function flattenReplyTextForNextQuote(raw: string): string {
  let s = String(raw ?? "");
  for (let i = 0; i < 12; i++) {
    const next = s.replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, " ");
    if (next === s) break;
    s = next;
  }
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
