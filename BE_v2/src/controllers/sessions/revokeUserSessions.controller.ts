import { Elysia, Context, t } from "elysia";
import { invalidateUserSessions } from "../../models/Session";
import { logError, logInfo } from "../../middlewares/logger";
import { requireAdmin, AuthUser } from "../../middlewares/auth";

// Admin: Revoke all sessions for a specific user
export const revokeUserSessionsController = new Elysia()
  .use(requireAdmin)
  .delete("/", async (context) => {
    const { user, set, params } = context as Context & { user: AuthUser; params: { userId: string } };
    const { userId } = params;

    try {
      await invalidateUserSessions(userId);
      
      await logInfo("All user sessions revoked by admin", {
        adminId: user.userId,
        targetUserId: userId,
      });
      
      return { message: `All sessions for user ${userId} revoked successfully` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;
      set.status = 500;
      await logError(`Error in revokeUserSessions: ${message}`, stack ? { stack } : undefined);
      return { error: "Failed to revoke user sessions", message };
    }
  }, {
    params: t.Object({
      userId: t.String(),
    }),
  });

