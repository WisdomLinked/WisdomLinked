import { Context, Elysia, t } from "elysia";
import { UserModel, AuthMethod } from "../../models/User";
import { generatePasswordResetExpiry, generateResetToken } from "../../utils/tokens";
import { logInfo } from "../../middlewares/logger";
import { AuthUser, requireAdmin } from "../../middlewares/auth";
import { getBackendEnvironmentConfig } from "../../config/env";

type AuthenticatedContext = Context & { user: AuthUser };
type UserIdParams = { id: string };
const { frontendUrl } = getBackendEnvironmentConfig();

// Generate password reset link
export const generatePasswordResetLinkController = new Elysia()
  .use(requireAdmin)
  .post("/", async (context) => {
    const { user, params } = context as AuthenticatedContext & { params: UserIdParams };

    try {
      const { id } = params;

      const targetUser = await UserModel.findById(id).select("+passwordResetToken +passwordResetExpires");

      if (!targetUser) {
        context.set.status = 404;
        return { error: "User not found" };
      }

      if (!targetUser.authMethods.includes(AuthMethod.LOCAL)) {
        context.set.status = 400;
        return { error: "User does not use password authentication" };
      }

      const resetToken = generateResetToken();
      const passwordResetExpires = generatePasswordResetExpiry();
      // Use targeted updateOne to avoid Mongoose save() issues with
      // select:false Map fields (missedChats) on partially-loaded documents.
      await UserModel.updateOne(
        { _id: targetUser._id },
        { $set: { passwordResetToken: resetToken, passwordResetExpires } }
      );

      await logInfo(`Password reset link generated for user ${targetUser.username}`, {
        userId: id,
        adminId: user.userId,
      });

      return {
        message: "Password reset link generated",
        resetToken,
        expiresAt: passwordResetExpires,
        resetLink: `${frontendUrl}/reset-password/${resetToken}`,
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to generate reset link", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to generate reset link", message: "Unknown error" };
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
  });

