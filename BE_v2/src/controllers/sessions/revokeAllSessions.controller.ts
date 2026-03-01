import { Elysia, Context } from "elysia";
import { SessionModel } from "../../models/Session";
import { logError, logInfo } from "../../middlewares/logger";
import { requireAuth, AuthUser } from "../../middlewares/auth";

// Revoke all sessions except the current one
export const revokeAllSessionsController = new Elysia()
  .use(requireAuth)
  .delete("/", async (context) => {
    const { user, set, request } = context as Context & { user: AuthUser };

    try {
      const authHeader = request.headers.get("authorization");
      const currentToken = authHeader?.substring(7);

      const result = await SessionModel.updateMany(
        { userId: user.userId, token: { $ne: currentToken }, isActive: true },
        { $set: { isActive: false } }
      );
      
      await logInfo("All other sessions revoked", { 
        userId: user.userId, 
        count: result.modifiedCount 
      });
      
      return { 
        message: "All other sessions revoked successfully",
        count: result.modifiedCount 
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;
      set.status = 500;
      await logError(`Error in revokeAllSessions: ${message}`, stack ? { stack } : undefined);
      return { error: "Failed to revoke all sessions", message };
    }
  });

