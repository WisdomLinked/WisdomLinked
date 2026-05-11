/** Extensions allowed for student-facing expert resume preview (PDF / Word). */
export const RESUME_ALLOWED_EXT = new Set(["pdf", "doc", "docx"]);

export const STUDENT_RESUME_BLOCKED_MESSAGE =
  "We've sent a note to the expert to replace their resume with a required file format (Word or PDF), and the resume will be visible to you later.";

/** Shown when preview fails (e.g. network); we do not email the expert in this case. */
export const STUDENT_RESUME_PREVIEW_UNAVAILABLE_MESSAGE =
  "We couldn't load a preview of this file. It may still be Word or PDF—try again later, or ask the expert to re-upload if the problem continues.";

/** Filename extension from URL path (lowercase), or "" if missing / extensionless. */
export function extensionFromUrl(fileUrl: string): string {
  try {
    const u = new URL(fileUrl, typeof window !== "undefined" ? window.location.href : "http://localhost");
    const base = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const dot = base.lastIndexOf(".");
    if (dot <= 0) return "";
    return base.slice(dot + 1).toLowerCase();
  } catch {
    const seg =
      fileUrl
        .split("?")[0]
        .split("#")[0]
        .split("/")
        .filter(Boolean)
        .pop() ?? "";
    const dot = seg.lastIndexOf(".");
    if (dot <= 0) return "";
    return seg.slice(dot + 1).toLowerCase();
  }
}

/** True when extension is present and not PDF/Word — immediate student-view block (no fetch). */
export function shouldBlockStudentResumeByExtension(ext: string): boolean {
  return !!ext && !RESUME_ALLOWED_EXT.has(ext);
}

export function isPdfMagic(ab: ArrayBuffer): boolean {
  if (ab.byteLength < 4) return false;
  const u = new Uint8Array(ab);
  return u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46;
}

export function isDocxZipMagic(ab: ArrayBuffer): boolean {
  if (ab.byteLength < 4) return false;
  const u = new Uint8Array(ab);
  return u[0] === 0x50 && u[1] === 0x4b && u[2] === 0x03 && u[3] === 0x04;
}

/** Legacy Microsoft Word .doc (OLE compound document). */
export function isOleDocMagic(ab: ArrayBuffer): boolean {
  if (ab.byteLength < 4) return false;
  const u = new Uint8Array(ab);
  return u[0] === 0xd0 && u[1] === 0xcf && u[2] === 0x11 && u[3] === 0xe0;
}

/**
 * First blocked-format view per expert per tab session triggers notify; duplicates suppressed.
 * Uses injected storage for tests.
 */
export function shouldSendResumeFormatNotifyOnce(expertId: string, storage: Pick<Storage, "getItem" | "setItem">): boolean {
  try {
    const k = `wl_resume_fmt_notify_${expertId}`;
    if (storage.getItem(k)) return false;
    storage.setItem(k, "1");
    return true;
  } catch {
    return true;
  }
}
