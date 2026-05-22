/** Result shape from Functions/imageUpload (and wrapped API responses). */
export type ProfileImageUploadDetail = {
  filename?: string;
  status?: string;
  error?: string;
};

export function pickUploadedProfileFilename(
  uploadResult: unknown,
  fallbackOriginalName?: string,
): string {
  const root = uploadResult as Record<string, unknown> | null | undefined;
  if (!root || typeof root !== "object") {
    return fallbackOriginalName ? String(fallbackOriginalName).trim() : "";
  }

  const topFilename = root.filename;
  if (typeof topFilename === "string" && topFilename.trim()) {
    return topFilename.trim();
  }

  const details = root.details as ProfileImageUploadDetail[] | undefined;
  if (Array.isArray(details)) {
    const uploaded = details.find(
      (d) => d?.status === "uploaded" && typeof d.filename === "string" && d.filename.trim(),
    );
    if (uploaded?.filename) return uploaded.filename.trim();

    const any = details.find(
      (d) => typeof d?.filename === "string" && d.filename.trim(),
    );
    if (any?.filename) return any.filename.trim();
  }

  const nested = root.data as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object") {
    const fromNested = pickUploadedProfileFilename(nested, fallbackOriginalName);
    if (fromNested) return fromNested;
  }

  return fallbackOriginalName ? String(fallbackOriginalName).trim() : "";
}

/** Store only the object key / filename on User.image (not a full URL). */
export function normalizeProfileImageRef(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) return null;
  if (/^https?:\/\//i.test(raw)) {
    const segment = raw.split("/").filter(Boolean).pop();
    return segment ? segment.trim() : null;
  }
  if (raw.includes("/")) {
    const segment = raw.split("/").filter(Boolean).pop();
    return segment ? segment.trim() : null;
  }
  return raw;
}
