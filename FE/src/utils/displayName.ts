/** Human-readable label when username is missing or stored as email / RC slug. */
export function wlDisplayName(user: { username?: string; email?: string } | null | undefined): string {
  if (!user) return "Someone";
  const raw = String(user.username ?? "").trim();
  if (raw && !looksLikeRcSlug(raw)) return raw;
  const email = String(user.email ?? "").trim();
  if (email) return formatEmailLocalPart(email);
  return formatRcSlugLabel(raw) || "Someone";
}

/** RC login slug derived from email (e.g. khussal_tamu.edu). */
export function looksLikeRcSlug(value: string): boolean {
  const v = String(value || "").trim();
  if (!v) return false;
  if (v.includes("@")) return true;
  return /^[a-z0-9]+([._][a-z0-9]+)+$/i.test(v);
}

export function formatEmailLocalPart(email: string): string {
  const local = String(email || "").split("@")[0];
  return formatRcSlugLabel(local) || "Someone";
}

export function formatRcSlugLabel(slug: string): string {
  const v = String(slug || "").trim();
  if (!v) return "";
  return v
    .replace(/@/g, " ")
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Prefer peer display name when quote author matches their RC slug. */
export function resolveReplyAuthorLabel(
  rawAuthor: string,
  opts?: { peerDisplayName?: string; peerSlug?: string },
): string {
  const author = String(rawAuthor || "").trim();
  if (!author) return "Message";
  const peerName = String(opts?.peerDisplayName || "").trim();
  const peerSlug = String(opts?.peerSlug || "").trim().toLowerCase();
  if (peerName && peerSlug && author.toLowerCase() === peerSlug) return peerName;
  if (peerName && looksLikeRcSlug(author) && peerName !== author) {
    const formatted = formatRcSlugLabel(author);
    if (formatted && peerName.toLowerCase().includes(formatted.split(" ")[0]?.toLowerCase() || "")) {
      return peerName;
    }
  }
  if (looksLikeRcSlug(author)) return formatRcSlugLabel(author);
  return author;
}
