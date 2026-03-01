/**
 * GridFS Storage Service — MongoDB GridFS file storage fallback.
 *
 * Used automatically when S3 environment variables are absent.
 * Files are stored in the "uploads" GridFS bucket of the active
 * Mongoose connection database.
 *
 * The bucket is lazy-initialised on first use so this module can be
 * imported before the database connection is established (Law 3 —
 * explicit effect handlers; lazy init prevents startup-order issues).
 *
 * Public URL format (served by the /api/v1/files/:id route):
 *   /api/v1/files/{objectIdString}
 */

import mongoose from "mongoose";
import { Readable } from "stream";

// ── Types ──────────────────────────────────────────────────────────────────

type MongoBucket = InstanceType<typeof mongoose.mongo.GridFSBucket>;

// ── Lazy bucket initialisation ─────────────────────────────────────────────

let _bucket: MongoBucket | null = null;

function _getBucket(): MongoBucket {
  if (_bucket !== null) {
    return _bucket;
  }
  const db = mongoose.connection.db;
  if (db === undefined) {
    throw new Error(
      "[gridfsStorage] MongoDB connection is not ready. " +
        "Ensure the database is connected before performing file operations."
    );
  }
  _bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "uploads" });
  return _bucket;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Upload a buffer to GridFS.
 *
 * Stores the file under the given filename (used as the GridFS filename
 * field, mirroring the S3 key concept).  Content-type is recorded in
 * the file metadata so it can be retrieved when serving the file.
 *
 * @returns The new file's ObjectId as a hex string.
 */
export async function gridfsUpload(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const bucket = _getBucket();

  return new Promise<string>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { contentType },
    });

    uploadStream.on("finish", () => {
      resolve(uploadStream.id.toString());
    });

    uploadStream.on("error", reject);

    uploadStream.end(buffer);
  });
}

/**
 * Delete all GridFS files that match the given filename.
 *
 * Multiple files with the same filename can exist (GridFS does not
 * enforce uniqueness on filename).  All versions are removed so that
 * re-uploading under the same key starts clean.
 */
export async function gridfsDelete(filename: string): Promise<void> {
  const bucket = _getBucket();
  const files = await bucket.find({ filename }).toArray();
  await Promise.all(files.map((file) => bucket.delete(file._id)));
}

/**
 * Open a readable download stream for the file identified by ObjectId string.
 *
 * Callers are responsible for handling stream errors (e.g. file not found
 * will cause an "error" event on the returned stream).
 */
export function gridfsStream(fileId: string): Readable {
  const bucket = _getBucket();
  const objectId = new mongoose.Types.ObjectId(fileId);
  return bucket.openDownloadStream(objectId) as Readable;
}

/**
 * Retrieve the stored content-type for a file by its ObjectId string.
 *
 * Returns null when the file does not exist or has no content-type metadata.
 * Used by the /api/v1/files/:id route to set the correct Content-Type header.
 */
export async function gridfsGetContentType(fileId: string): Promise<string | null> {
  const bucket = _getBucket();
  const objectId = new mongoose.Types.ObjectId(fileId);
  const files = await bucket.find({ _id: objectId }).toArray();

  if (files.length === 0) {
    return null;
  }

  const file = files[0];
  if (file === undefined) {
    return null;
  }

  const meta = file.metadata;
  if (meta === null || meta === undefined) {
    return null;
  }

  const ct = (meta as Record<string, unknown>)["contentType"];
  return typeof ct === "string" ? ct : null;
}

/**
 * Look up a GridFS file's ObjectId string by its filename (key).
 *
 * Returns null when no file with that filename exists.
 * Used by storage.getSignedUrl() to map an S3-style key to a GridFS URL.
 */
export async function gridfsGetFileId(filename: string): Promise<string | null> {
  const bucket = _getBucket();
  const files = await bucket.find({ filename }).limit(1).toArray();

  if (files.length === 0) {
    return null;
  }

  const file = files[0];
  return file !== undefined ? file._id.toString() : null;
}
