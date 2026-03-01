import { Elysia, t } from "elysia";
import { PendingPasswordResetModel } from "../../models/PendingPasswordReset";
import { SessionModel } from "../../models/Session";
import { UserModel } from "../../models/User";
import { hashPassword } from "../../utils/hash";

export const resetPasswordController = new Elysia().post(
  "/",
  async ({ body, set }) => {
    const { email, code, newPassword } = body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Find the pending reset record
      const pendingReset = await PendingPasswordResetModel.findOne({
        email: normalizedEmail,
      })
        .lean()
        .exec();

      if (!pendingReset) {
        set.status = 400;
        return { error: "Invalid or expired reset code" };
      }

      // Validate code matches
      if (pendingReset.code !== code) {
        set.status = 400;
        return { error: "Invalid or expired reset code" };
      }

      // Validate not expired
      if (pendingReset.expiresAt < new Date()) {
        await PendingPasswordResetModel.deleteOne({ email: normalizedEmail });
        set.status = 400;
        return { error: "Reset code has expired. Please request a new one" };
      }

      // Find the user
      const user = await UserModel.findOne({ email: normalizedEmail }).select("+password").exec();

      if (!user) {
        set.status = 400;
        return { error: "Invalid or expired reset code" };
      }

      // Hash the new password and update the user
      const hashedPassword = await hashPassword(newPassword);
      user.password = hashedPassword;
      await user.save();

      // Invalidate all existing sessions — force re-login everywhere
      await SessionModel.deleteMany({ userId: user._id });

      // Delete the consumed reset record
      await PendingPasswordResetModel.deleteOne({ email: normalizedEmail });

      return { message: "Password reset successful" };
    } catch (error) {
      set.status = 500;
      return {
        error: "Failed to reset password",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    body: t.Object({
      email: t.String({ format: "email" }),
      code: t.String({ minLength: 6, maxLength: 6 }),
      newPassword: t.String({ minLength: 8 }),
    }),
  }
);
