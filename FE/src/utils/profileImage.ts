export type ProfileImageFetcher = (imageRef: string, size: string) => Promise<unknown>;

export const isDisplayImageUrl = (value: unknown): value is string => {
  const v = typeof value === "string" ? value.trim() : "";
  return !!v && (/^https?:\/\//i.test(v) || /^data:image\//i.test(v) || /^blob:/i.test(v) || v.startsWith("/"));
};

export const resolveProfileImageSrc = async (
  imageRef: unknown,
  size: "small" | "medium" = "small",
  fetchProfileImage?: ProfileImageFetcher,
): Promise<string | null> => {
  const raw = typeof imageRef === "string" ? imageRef.trim() : "";
  if (!raw) return null;
  if (isDisplayImageUrl(raw)) return raw;
  if (!fetchProfileImage) return null;

  try {
    const fetched = await fetchProfileImage(raw, size);
    const url = typeof fetched === "string" ? fetched.trim() : "";
    return url || null;
  } catch {
    return null;
  }
};

