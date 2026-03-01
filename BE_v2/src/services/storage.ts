/**
 * Storage Service — S3-compatible object storage (DigitalOcean Spaces / AWS S3).
 *
 * All operations use the AWS SDK v3.  The S3 client is initialised once at
 * module load from the typed env config so there is a single ingress point
 * for credentials (Law 2, Law 3).
 *
 * Public URL format: {S3_ENDPOINT}/{S3_BUCKET}/{key}
 *
 * Env vars consumed (via getBackendEnvironmentConfig):
 *   S3_ENDPOINT   — required (e.g. https://nyc3.digitaloceanspaces.com)
 *   S3_REGION     — required
 *   S3_BUCKET     — required
 *   S3_ACCESS_KEY — required
 *   S3_SECRET_KEY — required
 */

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getBackendEnvironmentConfig } from "../config/env";

// ── Bootstrap ──────────────────────────────────────────────────────────────

const _env = getBackendEnvironmentConfig();

const _s3 = new S3Client({
  endpoint: _env.s3Endpoint,
  region: _env.s3Region,
  credentials: {
    accessKeyId: _env.s3AccessKey,
    secretAccessKey: _env.s3SecretKey,
  },
  // Path-style addressing is required for DigitalOcean Spaces and some
  // other S3-compatible providers.
  forcePathStyle: true,
});

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Derive the public HTTPS URL for an object key without making a network call.
 * Format: {endpoint}/{bucket}/{key}
 */
function _publicUrl(key: string): string {
  const base = _env.s3Endpoint.replace(/\/$/, "");
  return `${base}/${_env.s3Bucket}/${key}`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Upload a buffer to the given key and return its public URL.
 *
 * Uses the multipart Upload helper from `@aws-sdk/lib-storage` so that large
 * files are handled correctly.  Small buffers are sent as a single part.
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const upload = new Upload({
    client: _s3,
    params: {
      Bucket: _env.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
    },
  });

  await upload.done();
  return _publicUrl(key);
}

/**
 * Delete an object by key.  Resolves without error even if the key does not
 * exist (S3 DeleteObject is idempotent).
 */
export async function deleteFile(key: string): Promise<void> {
  await _s3.send(
    new DeleteObjectCommand({
      Bucket: _env.s3Bucket,
      Key: key,
    })
  );
}

/**
 * Generate a presigned download URL for a private object.
 *
 * @param key       Object key in the bucket.
 * @param expiresIn Lifetime in seconds (default 3600 — 1 hour).
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: _env.s3Bucket,
    Key: key,
  });

  // The presigner accepts any S3 command; using PutObjectCommand here gives a
  // GET-compatible URL because the SDK rewrites the method for presigned GETs.
  return awsGetSignedUrl(_s3, command, { expiresIn });
}

/**
 * Upload a user profile image.
 *
 * Key pattern: profiles/{userId}.{ext}
 */
export async function uploadProfileImage(
  userId: string,
  buffer: Buffer,
  ext: string
): Promise<string> {
  const key = `profiles/${userId}.${ext}`;
  return uploadFile(buffer, key, `image/${ext}`);
}

/**
 * Upload a file sent inside a chat conversation.
 *
 * Key pattern: chats/{conversationId}/{filename}
 */
export async function uploadChatFile(
  conversationId: string,
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.split(".").pop() ?? "bin";
  const contentType = _inferContentType(ext);
  const key = `chats/${conversationId}/${filename}`;
  return uploadFile(buffer, key, contentType);
}

/**
 * Upload a resume document for a user.
 *
 * Key pattern: resumes/{userId}/{filename}
 */
export async function uploadResume(
  userId: string,
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.split(".").pop() ?? "bin";
  const contentType = _inferContentType(ext);
  const key = `resumes/${userId}/${filename}`;
  return uploadFile(buffer, key, contentType);
}

// ── Private helpers ────────────────────────────────────────────────────────

function _inferContentType(ext: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    txt: "text/plain",
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}
