/**
 * Storage Service — S3-compatible object storage with MongoDB GridFS fallback.
 *
 * Behaviour is determined at module load by the presence of S3 environment
 * variables (Law 2 — single ingress, Law 3 — explicit effect handlers):
 *
 *   S3 mode  (s3Enabled = true):
 *     All five S3 env vars are present.  Files are stored in the configured
 *     S3-compatible bucket and public URLs are returned as
 *     {S3_ENDPOINT}/{S3_BUCKET}/{key}.
 *
 *   GridFS mode (s3Enabled = false):
 *     One or more S3 env vars are absent.  Files are stored in the MongoDB
 *     "uploads" GridFS bucket and URLs are returned as /api/v1/files/{objectId}.
 *     The GET /api/v1/files/:id route (routes/v1/files.ts) serves these files.
 *
 * The exported function signatures are IDENTICAL in both modes so that
 * callers (uploadAvatar, uploadResume, uploadChatFile controllers) require
 * zero changes.
 *
 * S3 env vars consumed (all optional — absence activates GridFS fallback):
 *   S3_ENDPOINT   — e.g. https://nyc3.digitaloceanspaces.com
 *   S3_REGION
 *   S3_BUCKET
 *   S3_ACCESS_KEY
 *   S3_SECRET_KEY
 */

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getBackendEnvironmentConfig } from "../config/env";
import { gridfsDelete, gridfsGetFileId, gridfsUpload } from "./gridfsStorage";

// ── Bootstrap ──────────────────────────────────────────────────────────────

const _env = getBackendEnvironmentConfig();

// Bundle the S3 client together with the bucket/endpoint strings so that all
// S3 operations receive typed non-nullable values (no conditional checks after
// the null guard at the function entry point).
interface S3Bundle {
  client: S3Client;
  bucket: string;
  endpoint: string;
}

function _buildS3Bundle(): S3Bundle | null {
  const { s3Endpoint, s3Region, s3Bucket, s3AccessKey, s3SecretKey } = _env;

  // All five vars must be present for S3 mode to activate.
  if (
    s3Endpoint === undefined ||
    s3Region === undefined ||
    s3Bucket === undefined ||
    s3AccessKey === undefined ||
    s3SecretKey === undefined
  ) {
    return null;
  }

  return {
    client: new S3Client({
      endpoint: s3Endpoint,
      region: s3Region,
      credentials: {
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
      },
      // Path-style addressing is required for DigitalOcean Spaces and other
      // S3-compatible providers.
      forcePathStyle: true,
    }),
    bucket: s3Bucket,
    endpoint: s3Endpoint,
  };
}

// Evaluated once at startup — null → GridFS mode, non-null → S3 mode.
const _s3: S3Bundle | null = _buildS3Bundle();

if (_s3 === null) {
  console.log("[storage] S3 not configured — using MongoDB GridFS fallback");
} else {
  console.log(`[storage] S3 enabled — bucket: ${_s3.bucket}`);
}

// ── Internal helpers ───────────────────────────────────────────────────────

function _s3PublicUrl(bundle: S3Bundle, key: string): string {
  const base = bundle.endpoint.replace(/\/$/, "");
  return `${base}/${bundle.bucket}/${key}`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Upload a buffer and return its public URL.
 *
 * S3 mode:    uploads to the configured bucket, returns the public HTTPS URL.
 * GridFS mode: writes to GridFS, returns /api/v1/files/{objectId}.
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  if (_s3 !== null) {
    const upload = new Upload({
      client: _s3.client,
      params: {
        Bucket: _s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read",
      },
    });
    await upload.done();
    return _s3PublicUrl(_s3, key);
  }

  // GridFS fallback
  const fileId = await gridfsUpload(buffer, key, contentType);
  return `/api/v1/files/${fileId}`;
}

/**
 * Delete an object by key.
 *
 * S3 mode:    sends DeleteObjectCommand (idempotent — no error if missing).
 * GridFS mode: deletes all GridFS files with matching filename.
 */
export async function deleteFile(key: string): Promise<void> {
  if (_s3 !== null) {
    await _s3.client.send(
      new DeleteObjectCommand({ Bucket: _s3.bucket, Key: key })
    );
    return;
  }

  // GridFS fallback
  await gridfsDelete(key);
}

/**
 * Generate a presigned download URL for an object.
 *
 * S3 mode:    returns an AWS presigned URL valid for `expiresIn` seconds.
 * GridFS mode: returns the static /api/v1/files/{objectId} URL (no signing
 *              needed — access control is handled by the route middleware).
 *
 * @param key       Object key / GridFS filename.
 * @param expiresIn Lifetime in seconds (S3 mode only; default 3600).
 */
export async function getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  if (_s3 !== null) {
    const command = new PutObjectCommand({ Bucket: _s3.bucket, Key: key });
    return awsGetSignedUrl(_s3.client, command, { expiresIn });
  }

  // GridFS: resolve the stored ObjectId for this key so the URL matches
  // the one returned by uploadFile.
  const fileId = await gridfsGetFileId(key);
  if (fileId !== null) {
    return `/api/v1/files/${fileId}`;
  }

  // File not yet uploaded — return a forward-looking URL using the encoded key.
  return `/api/v1/files/${encodeURIComponent(key)}`;
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
