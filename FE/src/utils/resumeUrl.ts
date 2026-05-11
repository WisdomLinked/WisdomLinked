/** Build a browser-usable URL for an expert resume (relative path or absolute). */
export function resolveResumePublicUrl(resume: unknown): string {
  const s = typeof resume === "string" ? resume.trim() : "";
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const base =
    typeof process !== "undefined" ? String(process.env.REACT_APP_SERVER_URL || "").replace(/\/$/, "") : "";
  if (!base) return s;
  return `${base}/${s.replace(/^\//, "")}`;
}

/** True when a resume can be opened for preview (avoids empty / whitespace-only fields). */
export function hasResumeForPreview(resume: unknown): boolean {
  return resolveResumePublicUrl(resume).length > 0;
}
