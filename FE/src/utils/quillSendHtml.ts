/** Normalize ReactQuill HTML before send (drop empty trailing paragraphs). */
export function normalizeQuillHtmlForSend(html: string): string {
  const raw = String(html ?? "").trim();
  if (!raw || raw === "<p><br></p>") return "";
  return raw.replace(/(<p><br><\/p>\s*)+$/gi, "").trim();
}

export function isQuillComposerEmpty(html: string): boolean {
  return !normalizeQuillHtmlForSend(html);
}
