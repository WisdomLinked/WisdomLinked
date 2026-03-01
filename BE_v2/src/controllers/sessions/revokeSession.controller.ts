import { Elysia, Context, t } from "elysia";
import { SessionModel } from "../../models/Session";
import { logError, logInfo } from "../../middlewares/logger";
import { requireAuth, AuthUser } from "../../middlewares/auth";

// Revoke a specific session
export const revokeSessionController = new Elysia()
  .use(requireAuth)
  .delete("/", async (context) => {
    const { user, set, params } = context as Context & { user: AuthUser; params: { sessionId: string } };

    try {
      const { sessionId } = params;
      const session = await SessionModel.findOne({
        _id: sessionId,
        userId: user.userId,
      });

      if (!session) {
        set.status = 404;
        return { error: "Session not found" };
      }

      session.isActive = false;
      await session.save();
      
      await logInfo("Session revoked", { sessionId, userId: user.userId });
      return { message: "Session revoked successfully" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;
      set.status = 500;
      await logError(`Error in revokeSession: ${message}`, stack ? { stack } : undefined);
      return { error: "Failed to revoke session", message };
    }
  }, {
    params: t.Object({
      sessionId: t.String(),
    }),
  });

