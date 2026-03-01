import { Context, Elysia, t } from "elysia";
import { UserModel, AuthMethod } from "../../models/User";
import { invalidateUserSessions } from "../../models/Session";
import { hashPassword } from "../../utils/hash";
import { logInfo } from "../../middlewares/logger";
import { AuthUser, requireAdmin } from "../../middlewares/auth";

type AuthenticatedContext = Context & { user: AuthUser };
type UserIdParams = { id: string };

// Reset user password (generates a temporary password)
export const resetUserPasswordController = new Elysia()
  .use(requireAdmin)
  .post("/", async (context) => {
    const { user, params, body } = context as AuthenticatedContext & { params: UserIdParams; body: { newPassword: string } };

    try {
      const { id } = params;
      const { newPassword } = body;

      if (!newPassword || newPassword.length < 6) {
        context.set.status = 400;
        return { error: "Password must be at least 6 characters" };
      }

      const targetUser = await UserModel.findById(id).select("+password +passwordResetToken +passwordResetExpires");

      if (!targetUser) {
        context.set.status = 404;
        return { error: "User not found" };
      }

      // Check if user has local auth method
      if (!targetUser.authMethods.includes(AuthMethod.LOCAL)) {
        context.set.status = 400;
        return { error: "User does not use password authentication" };
      }

      const hashedPassword = await hashPassword(newPassword);
      targetUser.password = hashedPassword;
      targetUser.passwordResetToken = undefined;
      targetUser.passwordResetExpires = undefined;
      await targetUser.save();

      // Invalidate all sessions for this user (local auth only)
      if (targetUser.authMethods.includes(AuthMethod.LOCAL)) {
        await invalidateUserSessions(targetUser._id.toString());
      }

      await logInfo(`Password reset for user ${targetUser.username}`, {
        userId: id,
        adminId: user.userId,
      });

      return {
        message: "Password reset successfully. All sessions have been invalidated.",
        user: {
          id: targetUser._id.toString(),
          username: targetUser.username,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to reset password", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to reset password", message: "Unknown error" };
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Object({
      newPassword: t.String({ minLength: 6 }),
    }),
  });

