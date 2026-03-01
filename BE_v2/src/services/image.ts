/**
 * Image Service — Sharp-based image processing utilities.
 *
 * All exported functions are pure with respect to their inputs: given the same
 * buffer they always produce the same output (Law 3 — pure core).  There is no
 * module-level state, no I/O, and no side effects beyond the buffer transform.
 *
 * Supported formats for validation: jpeg, png, webp, gif.
 * Maximum validated file size: 10 MB.
 */

import sharp from "sharp";

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_FORMATS: ReadonlySet<string> = new Set(["jpeg", "png", "webp", "gif"]);

// ── Types ──────────────────────────────────────────────────────────────────

export interface ImageValidationResult {
  valid: boolean;
  width: number;
  height: number;
  format: string;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Resize an image to 300×300, convert to WebP at quality 80.
 * Intended for user profile avatars.
 */
export async function resizeProfileImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(300, 300, { fit: "cover", position: "centre" })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Produce a thumbnail at the requested dimensions (default 150×150), WebP.
 *
 * @param buffer Source image buffer.
 * @param width  Thumbnail width  (default 150).
 * @param height Thumbnail height (default 150).
 */
export async function createThumbnail(
  buffer: Buffer,
  width: number = 150,
  height: number = 150
): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, { fit: "cover", position: "centre" })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Validate a buffer as an image.
 *
 * Checks:
 *  1. File size ≤ 10 MB.
 *  2. Format is one of: jpeg, png, webp, gif.
 *  3. Sharp can successfully read the buffer metadata.
 *
 * Returns structured metadata rather than throwing so callers can branch on
 * the `valid` flag without catching exceptions (Law 8 — totality).
 */
export async function validateImage(buffer: Buffer): Promise<ImageValidationResult> {
  if (buffer.length > MAX_IMAGE_BYTES) {
    return { valid: false, width: 0, height: 0, format: "" };
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    // Sharp cannot parse the data — not a supported image at all.
    return { valid: false, width: 0, height: 0, format: "" };
  }

  const format = metadata.format ?? "";
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!ALLOWED_FORMATS.has(format)) {
    return { valid: false, width, height, format };
  }

  return { valid: true, width, height, format };
}

/**
 * Optimise a chat image for inline display.
 *
 * Constrains the longest dimension to 1200 px and re-encodes to WebP at
 * quality 75.  Portrait and landscape images are handled uniformly via
 * `withoutEnlargement`.
 */
export async function optimizeForChat(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1200, 1200, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();
}
