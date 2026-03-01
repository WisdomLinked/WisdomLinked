import { Elysia, Context, t } from "elysia";
import { SessionModel } from "../../models/Session";
import { logError } from "../../middlewares/logger";
import { requireAdmin } from "../../middlewares/auth";

// Admin: Get sessions for a specific user
export const getSessionsForUserController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    const { set, params } = context as Context & { params: { userId: string } };
    const { userId } = params;

    try {
      const sessions = await SessionModel.find({
        userId: userId,
        isActive: true,
        expiresAt: { $gt: new Date() },
      }).sort({ lastActivity: -1 });

      return {
        sessions: sessions.map((session) => ({
          id: session._id.toString(),
          ipAddress: session.ipAddress,
          deviceInfo: session.deviceInfo,
          lastActivity: session.lastActivity,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;
      set.status = 500;
      await logError(`Error in getSessionsForUser: ${message}`, stack ? { stack } : undefined);
      return { error: "Failed to fetch user sessions", message };
    }
  }, {
    params: t.Object({
      userId: t.String(),
    }),
  });

