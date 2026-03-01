import { Elysia } from "elysia";
import { LogModel } from "../../models/Log";
import { requireAdmin } from "../../middlewares/auth";

export const getLogsController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const page = parseInt(context.query.page) || 1;
      const limit = parseInt(context.query.limit) || 50;
      const level = context.query.level;

      const query: { level?: string; message?: { $regex: string; $options: string } } = {};
      if (level) {
        query.level = level;
      }

      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        LogModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
        LogModel.countDocuments(query),
      ]);

      return {
        logs: logs.map((log) => ({
          id: log._id.toString(),
          level: log.level,
          message: log.message,
          metadata: log.metadata,
          timestamp: log.timestamp,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to fetch logs", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to fetch logs", message: "Unknown error" };
    }
  });

