import { Elysia, Context } from "elysia";
import { SessionModel } from "../../models/Session";
import { requireAuth } from "../../middlewares/auth";
import { logInfo } from "../../middlewares/logger";
import { AuthUser } from "../../middlewares/auth";

export const logoutController = new Elysia()
  .use(requireAuth)
  .post("/", async (context) => {
    const { user } = context as Context & { user: AuthUser };
    
    // Invalidate the current session
    try {
      const request = context.request as Request;
      const authHeader = request.headers.get("authorization");
      const token = authHeader?.substring(7);

      if (token) {
        await SessionModel.updateOne(
          { token, isActive: true },
          { isActive: false }
        );
      }

      await logInfo("User logged out", { username: user?.username });
    } catch (error) {
      console.error("Error during logout:", error);
    }

    return { message: "Logged out successfully" };
  });

