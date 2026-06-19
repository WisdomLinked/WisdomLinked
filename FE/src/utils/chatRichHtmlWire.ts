export const WL_HTML_WIRE_PREFIX = "__WL_HTML__";

export function isRichHtmlWire(content: string): boolean {
  return String(content ?? "").trim().startsWith(`${WL_HTML_WIRE_PREFIX}|`);
}

export function decodeRichHtmlWire(content: string): string | null {
  const raw = String(content ?? "").trim();
  if (!isRichHtmlWire(raw)) return null;
  const encoded = raw.slice(WL_HTML_WIRE_PREFIX.length + 1);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/** Prefer stored rich HTML; fall back to raw content for legacy plain messages. */
export function resolveMessageDisplayHtml(content: string): string {
  const decoded = decodeRichHtmlWire(content);
  if (decoded) return decoded;
  return String(content ?? "");
}
