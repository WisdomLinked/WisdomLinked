import { Elysia } from "elysia";
import { MetricsModel } from "../../models/Metrics";
import { requireAdmin } from "../../middlewares/auth";

export const getMetricsController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const page = parseInt(context.query.page) || 1;
      const limit = parseInt(context.query.limit) || 50;
      const path = context.query.path;

      const query: { path?: string } = {};
      if (path) {
        query.path = path;
      }

      const skip = (page - 1) * limit;

      const [metrics, total] = await Promise.all([
        MetricsModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
        MetricsModel.countDocuments(query),
      ]);

      return {
        metrics: metrics.map((metric) => ({
          id: metric._id.toString(),
          path: metric.path,
          method: metric.method,
          ip: metric.ip,
          username: metric.username,
          userId: metric.userId,
          isAuthenticated: metric.isAuthenticated,
          timestamp: metric.timestamp,
          responseTime: metric.responseTime,
          statusCode: metric.statusCode,
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
        return { error: "Failed to fetch metrics", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to fetch metrics", message: "Unknown error" };
    }
  });

