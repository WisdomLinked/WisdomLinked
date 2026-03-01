/**
 * GridFS file-serving route.
 *
 * GET /api/v1/files/:id
 *
 * Streams a file stored in MongoDB GridFS back to the client with the
 * correct Content-Type header.  This route is only meaningful when the
 * storage service is running in GridFS mode (S3 env vars absent), but it
 * is always registered — it is harmless when S3 is configured because no
 * /api/v1/files/* URLs will be stored in the database in that mode.
 *
 * Error responses:
 *   404 — file not found or invalid ObjectId
 */

import { Elysia } from "elysia";
import { Types } from "mongoose";
import { gridfsGetContentType, gridfsStream } from "../../services/gridfsStorage";

export const filesRoutes = new Elysia({ prefix: "/api/v1/files" }).get(
  "/:id",
  async ({ params, set }) => {
    const { id } = params;

    // Validate that :id is a valid MongoDB ObjectId before hitting the DB.
    if (!Types.ObjectId.isValid(id)) {
      set.status = 404;
      return { error: "File not found" };
    }

    try {
      // Retrieve content-type from GridFS metadata first so we can return 404
      // cleanly without starting a download stream for a missing file.
      const contentType = await gridfsGetContentType(id);
      if (contentType === null) {
        set.status = 404;
        return { error: "File not found" };
      }

      // Buffer the GridFS download stream into a single Buffer and return a
      // native Response so Elysia passes it through unmodified with the
      // correct Content-Type header.
      const nodeStream = gridfsStream(id);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        nodeStream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        nodeStream.on("end", resolve);
        nodeStream.on("error", reject);
      });

      return new Response(Buffer.concat(chunks), {
        headers: { "Content-Type": contentType },
      });
    } catch (_err) {
      set.status = 404;
      return { error: "File not found" };
    }
  }
);
