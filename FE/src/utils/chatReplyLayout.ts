/**
 * WisdomLinked thread replies are sent as
 * `<blockquote><strong>Replying to Name</strong><br>excerpt</blockquote>` + body.
 * When people reply in a chain, multiple blockquotes stack and read as one blob.
 * This module peels those into structured data for layout, and flattens text for the next excerpt.
 */

export type PeeledReplyQuote = { to: string; excerpt: string };

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

/** Match `<blockquote><strong>Replying to X</strong>...` produced by NewMessageInput. */
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
  const wrap = doc.createElement("div");
  const maxPeels = 12;

  for (let i = 0; i < maxPeels; i++) {
    wrap.innerHTML = remaining;
    const first = skipLeadingEmptyNodes(wrap);
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

    quotes.push({ to, excerpt });
    first.remove();
    remaining = wrap.innerHTML.trim();
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
    /^<blockquote[^>]*>\s*<strong>\s*Replying to\s+([^<]+)<\/strong>\s*<br\s*\/?>\s*([\s\S]*?)<\/blockquote>/i;

  for (let i = 0; i < 12; i++) {
    const m = remaining.match(re);
    if (!m) break;
    const to = m[1].trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const excerpt = m[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    quotes.push({ to, excerpt });
    remaining = remaining.slice(m[0].length).trim();
  }
  return { quotes, bodyHtml: remaining };
}

/**
 * Strip reply blockquotes and tags before embedding an excerpt in the next send.
 * (Full-thread excerpts should come from `peelWisdomLinkedReplyQuotes` + body in the draft builder.)
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
