import { Elysia, Context } from "elysia";
import { SessionModel } from "../../models/Session";
import { logError } from "../../middlewares/logger";
import { requireAuth, AuthUser } from "../../middlewares/auth";

// Get all active sessions for current user
export const getUserSessionsController = new Elysia()
  .use(requireAuth)
  .get("/", async (context) => {
    const { user, set, request } = context as Context & { user: AuthUser };

    try {
      const sessions = await SessionModel.find({
        userId: user.userId,
        isActive: true,
        expiresAt: { $gt: new Date() },
      }).sort({ lastActivity: -1 });

      // Get current session token from canonical header source
      const authHeader = request.headers.get("authorization");
      const currentToken = authHeader?.substring(7);

      return {
        sessions: sessions.map((session) => ({
          id: session._id.toString(),
          ipAddress: session.ipAddress,
          deviceInfo: session.deviceInfo,
          lastActivity: session.lastActivity,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          isCurrent: session.token === currentToken,
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;
      set.status = 500;
      await logError(`Error in getUserSessions: ${message}`, stack ? { stack } : undefined);
      return { error: "Failed to fetch sessions", message };
    }
  });

