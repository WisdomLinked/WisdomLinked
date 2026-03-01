import { Elysia } from "elysia";
import { LogModel } from "../../models/Log";
import { requireAdmin } from "../../middlewares/auth";

export const clearLogsController = new Elysia()
  .use(requireAdmin)
  .delete("/", async (context) => {
    try {
      await LogModel.deleteMany({});
      return { message: "Logs cleared successfully" };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to clear logs", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to clear logs", message: "Unknown error" };
    }
  });

