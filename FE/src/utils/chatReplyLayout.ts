/**
 * WisdomLinked thread replies are sent as HTML in the composer, encoded to RC plain text:
 * `__WL_REPLY__|messageId|author|excerpt|\nbody` (see BE chatReplyPlainText).
 * This module peels wire/plain/HTML into structured data for layout.
 */

export const WL_REPLY_WIRE_PREFIX = "__WL_REPLY__";

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

function decodeWireField(value: string): string {
  try {
    return decodeURIComponent(String(value || "").trim());
  } catch {
    return String(value || "").trim();
  }
}

/** Peel `__WL_REPLY__|id|author|excerpt|\nbody` (Rocket.Chat stored format). */
export function peelWireFormatReply(content: string): {
  quotes: PeeledReplyQuote[];
  bodyHtml: string;
} | null {
  const raw = String(content ?? "").trim();
  if (!raw.startsWith(`${WL_REPLY_WIRE_PREFIX}|`)) return null;

  const quotes: PeeledReplyQuote[] = [];
  let remaining = raw;

  const lineRe = new RegExp(
    `^${WL_REPLY_WIRE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\|([^|]+)\\|([^|]+)\\|([^|]*)\\|\\n?`,
    "i",
  );

  for (let i = 0; i < 12; i++) {
    const m = remaining.match(lineRe);
    if (!m) break;
    quotes.push({
      messageId: m[1].trim(),
      to: decodeWireField(m[2]),
      excerpt: decodeWireField(m[3]),
    });
    remaining = remaining.slice(m[0].length);
    if (!remaining.trim().startsWith(`${WL_REPLY_WIRE_PREFIX}|`)) break;
  }

  if (!quotes.length) return null;
  return { quotes, bodyHtml: remaining.trim() };
}

/**
 * Legacy RC plain text (pre-wire): leading `Replying to Name` blocks before body.
 */
export function peelLegacyPlainReplyQuotes(content: string): {
  quotes: PeeledReplyQuote[];
  bodyHtml: string;
} {
  const quotes: PeeledReplyQuote[] = [];
  let remaining = String(content ?? "").trim();
  if (!/^Replying to\s+/i.test(remaining)) {
    return { quotes, bodyHtml: remaining };
  }

  const headerRe = /^Replying to\s+([^\n\r]+)\r?\n/i;

  for (let i = 0; i < 12; i++) {
    if (!headerRe.test(remaining)) break;
    const m = remaining.match(/^Replying to\s+([^\n\r]+)\r?\n([\s\S]*)$/i);
    if (!m) break;

    const to = m[1].trim();
    let rest = m[2];

    const nextIdx = rest.search(/\r?\nReplying to\s+/i);
    if (nextIdx >= 0) {
      const excerpt = rest
        .slice(0, nextIdx)
        .replace(/\r?\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      quotes.push({ to, excerpt });
      remaining = rest.slice(nextIdx).replace(/^\r?\n/, "").trim();
      continue;
    }

    const lines = rest.split(/\r?\n/).filter((line, idx, arr) => {
      if (idx === arr.length - 1 && !line.trim()) return false;
      return true;
    });

    if (lines.length <= 1) {
      const only = (lines[0] || rest).trim();
      quotes.push({ to, excerpt: only });
      remaining = "";
    } else {
      const excerpt = lines[0].trim();
      const body = lines.slice(1).join("\n").trim();
      quotes.push({ to, excerpt });
      remaining = body;
    }
    break;
  }

  return { quotes, bodyHtml: remaining };
}

function plainBodyToDisplayHtml(body: string): string {
  const text = String(body || "").trim();
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\r?\n/g, "<br>")}</p>`;
}

/** Match WisdomLinked reply blockquotes (with optional data-wl-reply-id). */
export function peelWisdomLinkedReplyQuotes(html: string): {
  quotes: PeeledReplyQuote[];
  bodyHtml: string;
} {
  const raw = String(html ?? "").trim();
  if (!raw) return { quotes, bodyHtml: "" };

  const wire = peelWireFormatReply(raw);
  if (wire) {
    return { quotes: wire.quotes, bodyHtml: plainBodyToDisplayHtml(wire.bodyHtml) };
  }

  const legacy = peelLegacyPlainReplyQuotes(raw);
  if (legacy.quotes.length > 0) {
    return { quotes: legacy.quotes, bodyHtml: plainBodyToDisplayHtml(legacy.bodyHtml) };
  }

  if (typeof document === "undefined") {
    return peelWisdomLinkedReplyQuotesRegex(raw);
  }

  const quotes: PeeledReplyQuote[] = [];
  let remaining = raw;

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
