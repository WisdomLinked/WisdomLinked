import { Elysia } from "elysia";
import { MetricsModel } from "../../models/Metrics";
import { requireAdmin } from "../../middlewares/auth";

export const clearMetricsController = new Elysia()
  .use(requireAdmin)
  .delete("/", async (context) => {
    try {
      await MetricsModel.deleteMany({});
      return { message: "Metrics cleared successfully" };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to clear metrics", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to clear metrics", message: "Unknown error" };
    }
  });

