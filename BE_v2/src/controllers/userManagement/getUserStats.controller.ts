import { Elysia } from "elysia";
import { UserModel, AuthMethod } from "../../models/User";
import { requireAdmin } from "../../middlewares/auth";
import { UserRole } from "../../config/roles";

// Get user statistics
export const getUserStatsController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const [
        total,
        active,
        inactive,
        admins,
        localUsers,
        oauthUsers,
      ] = await Promise.all([
        UserModel.countDocuments(),
        UserModel.countDocuments({ isActive: true }),
        UserModel.countDocuments({ isActive: false }),
        UserModel.countDocuments({ role: UserRole.ADMIN }),
        UserModel.countDocuments({ authMethods: AuthMethod.LOCAL }),
        UserModel.countDocuments({ authMethods: AuthMethod.DISCORD }),
      ]);

      return {
        total,
        active,
        inactive,
        admins,
        byAuthMethod: {
          local: localUsers,
          discord: oauthUsers,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to get user stats", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to get user stats", message: "Unknown error" };
    }
  });

