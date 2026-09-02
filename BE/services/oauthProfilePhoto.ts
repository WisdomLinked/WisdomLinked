import { pickUploadedProfileFilename } from "../utils/profileImageFilename";

const { uploadImageToStorage } = require("./imageUploadService");
const { isProfileImageStorageConfigured } = require("./profileImageStorage");

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;

type OAuthProfilePhotoDeps = {
  fetchFn?: typeof fetch;
  uploadFn?: (file: {
    buffer: Buffer;
    originalname?: string;
    mimetype?: string;
  }) => Promise<unknown>;
};

function isLocalDev(): boolean {
  const fe = String(process.env.FE_URL || "");
  return fe.includes("localhost") || fe.includes("127.0.0.1");
}

export function isOAuthPhotoUrlAllowed(photoUrl: string): boolean {
  const raw = String(photoUrl || "").trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    if (u.protocol === "https:") return true;
    if (isLocalDev() && u.protocol === "http:") return true;
    return false;
  } catch {
    return false;
  }
}

function userHasProfileImage(user: { image?: unknown }): boolean {
  return !!String(user?.image || "").trim();
}

async function downloadOAuthProfilePhoto(
  photoUrl: string,
  fetchFn: typeof fetch,
): Promise<{ buffer: Buffer; mimetype: string } | null> {
  const res = await fetchFn(photoUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "image/*" },
  });
  if (!res.ok) return null;

  const contentType = String(res.headers.get("content-type") || "").split(";")[0].trim();
  if (!contentType.toLowerCase().startsWith("image/")) return null;

  const arrayBuffer = await res.arrayBuffer();
  if (!arrayBuffer.byteLength || arrayBuffer.byteLength > MAX_PHOTO_BYTES) return null;

  return {
    buffer: Buffer.from(arrayBuffer),
    mimetype: contentType,
  };
}

/**
 * Download provider profile photo and store in DO Spaces (filename on User.image).
 * Non-fatal: returns false on skip or failure without throwing.
 */
export async function importOAuthProfilePhoto(
  user: { image?: unknown; save?: () => Promise<unknown> },
  photoUrl: string | undefined | null,
  deps: OAuthProfilePhotoDeps = {},
): Promise<boolean> {
  try {
    if (userHasProfileImage(user)) return false;
    if (!isProfileImageStorageConfigured()) {
      console.warn("[OAuth] profile photo import skipped: image storage not configured");
      return false;
    }

    const url = String(photoUrl || "").trim();
    if (!url || !isOAuthPhotoUrlAllowed(url)) return false;

    const fetchFn = deps.fetchFn || globalThis.fetch;
    const uploadFn = deps.uploadFn || uploadImageToStorage;

    const downloaded = await downloadOAuthProfilePhoto(url, fetchFn);
    if (!downloaded) {
      console.warn("[OAuth] profile photo import: download failed or invalid image");
      return false;
    }

    const ext =
      downloaded.mimetype === "image/png"
        ? ".png"
        : downloaded.mimetype === "image/webp"
          ? ".webp"
          : ".jpg";

    const uploadResult = await uploadFn({
      buffer: downloaded.buffer,
      originalname: `google-profile${ext}`,
      mimetype: downloaded.mimetype,
    });

    const filename = pickUploadedProfileFilename(uploadResult, `google-profile${ext}`);
    if (!filename) {
      console.warn("[OAuth] profile photo import: upload returned no filename");
      return false;
    }

    (user as { image?: string }).image = filename;
    if (typeof user.save === "function") {
      await user.save();
    }
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[OAuth] profile photo import:", msg);
    return false;
  }
}

module.exports = {
  isOAuthPhotoUrlAllowed,
  importOAuthProfilePhoto,
};
