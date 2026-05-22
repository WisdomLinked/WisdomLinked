import path from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const normalizeSpacesHost = (v: string) =>
  String(v || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .trim();

const spacesEndpointHost = normalizeSpacesHost(process.env.DO_SPACES_ENDPOINT || "");
const doEndpoint = spacesEndpointHost ? `https://${spacesEndpointHost}` : undefined;

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: doEndpoint,
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.DO_SPACES_KEY || "",
        secretAccessKey: process.env.DO_SPACES_SECRET || "",
      },
      forcePathStyle: false,
    });
  }
  return s3Client;
}

function isProfileImageStorageConfigured(): boolean {
  return !!(
    process.env.DO_SPACES_BUCKET &&
    process.env.DO_SPACES_KEY &&
    process.env.DO_SPACES_SECRET &&
    spacesEndpointHost
  );
}

function buildStoredProfileFilename(originalName?: string): string {
  const raw = String(originalName || "profile.jpg").trim();
  const ext = path.extname(raw) || ".jpg";
  const base = path
    .basename(raw, ext)
    .replace(/[^\w.\-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "profile";
  return `${base}_${Date.now()}${ext.toLowerCase()}`;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function uploadProfileImageToSpaces(file: {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
}): Promise<{
  message: string;
  filename: string;
  details: Array<{ filename: string; status: string }>;
}> {
  if (!isProfileImageStorageConfigured()) {
    throw new Error("Image storage is not configured (DO Spaces).");
  }

  const bucket = String(process.env.DO_SPACES_BUCKET).trim();
  const filename = buildStoredProfileFilename(file.originalname);
  const contentType = file.mimetype || "image/jpeg";
  const client = getS3Client();

  const originalKey = `originals/${filename}`;
  const smallKey = `small/${filename}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: originalKey,
      Body: file.buffer,
      ACL: "public-read",
      ContentType: contentType,
    }),
  );

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: smallKey,
      Body: file.buffer,
      ACL: "public-read",
      ContentType: contentType,
    }),
  );

  return {
    message: "Files processed",
    filename,
    details: [{ filename, status: "uploaded" }],
  };
}

async function getProfileImageFromSpaces(
  file: string,
  size: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  if (!isProfileImageStorageConfigured()) return null;

  const bucket = String(process.env.DO_SPACES_BUCKET).trim();
  const basename = String(file || "").trim();
  if (!basename) return null;

  const keys = [
    `${size}/${basename}`,
    `originals/${basename}`,
    `${size}/originals/${basename}`,
  ];

  const client = getS3Client();
  for (const Key of keys) {
    try {
      const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key }));
      const data = await streamToBuffer(obj.Body);
      if (!data.length) continue;
      return {
        data,
        contentType: obj.ContentType || "image/jpeg",
      };
    } catch {
      // try next key
    }
  }
  return null;
}

module.exports = {
  isProfileImageStorageConfigured,
  buildStoredProfileFilename,
  uploadProfileImageToSpaces,
  getProfileImageFromSpaces,
};
