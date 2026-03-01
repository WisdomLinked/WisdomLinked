import { Elysia } from "elysia";
import { MetricsModel } from "../../models/Metrics";
import { requireAdmin } from "../../middlewares/auth";

export const getMetricsSummaryController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const [
        totalRequests,
        authenticatedRequests,
        anonymousRequests,
        uniquePaths,
        recentActivity,
      ] = await Promise.all([
        MetricsModel.countDocuments(),
        MetricsModel.countDocuments({ isAuthenticated: true }),
        MetricsModel.countDocuments({ isAuthenticated: false }),
        MetricsModel.distinct("path"),
        MetricsModel.find().sort({ timestamp: -1 }).limit(10),
      ]);

      // Get endpoint hit counts
      const endpointStats = await MetricsModel.aggregate([
        {
          $group: {
            _id: "$path",
            count: { $sum: 1 },
            avgResponseTime: { $avg: "$responseTime" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      return {
        summary: {
          totalRequests,
          authenticatedRequests,
          anonymousRequests,
          uniquePaths: uniquePaths.length,
        },
        topEndpoints: endpointStats.map((stat) => ({
          path: stat._id,
          count: stat.count,
          avgResponseTime: Math.round(stat.avgResponseTime || 0),
        })),
        recentActivity: recentActivity.map((metric) => ({
          id: metric._id.toString(),
          path: metric.path,
          method: metric.method,
          username: metric.username,
          isAuthenticated: metric.isAuthenticated,
          timestamp: metric.timestamp,
          responseTime: metric.responseTime,
        })),
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to fetch metrics summary", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to fetch metrics summary", message: "Unknown error" };
    }
  });

