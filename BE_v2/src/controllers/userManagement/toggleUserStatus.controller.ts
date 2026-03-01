import { Context, Elysia, t } from "elysia";
import { UserModel } from "../../models/User";
import { logInfo } from "../../middlewares/logger";
import { AuthUser, requireAdmin } from "../../middlewares/auth";

type AuthenticatedContext = Context & { user: AuthUser };
type UserIdParams = { id: string };

// Toggle user active status
export const toggleUserStatusController = new Elysia()
  .use(requireAdmin)
  .put("/", async (context) => {
    const { user, params } = context as AuthenticatedContext & { params: UserIdParams };

    try {
      const { id } = params;

      const targetUser = await UserModel.findById(id);

      if (!targetUser) {
        context.set.status = 404;
        return { error: "User not found" };
      }

      // Compute toggled value and persist with targeted updateOne to avoid
      // Mongoose save() issues with select:false Map fields on partially-loaded documents.
      const newIsActive = !targetUser.isActive;
      await UserModel.updateOne({ _id: targetUser._id }, { $set: { isActive: newIsActive } });

      await logInfo(`User ${targetUser.username} status changed to ${newIsActive ? "active" : "inactive"}`, {
        userId: id,
        adminId: user.userId,
      });

      return {
        message: `User ${newIsActive ? "enabled" : "disabled"} successfully`,
        user: {
          id: targetUser._id.toString(),
          username: targetUser.username,
          isActive: newIsActive,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to toggle user status", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to toggle user status", message: "Unknown error" };
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
  });

