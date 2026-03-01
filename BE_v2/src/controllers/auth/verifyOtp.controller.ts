import { Context, Elysia, t } from "elysia";
import { PendingLoginModel } from "../../models/PendingLogin";
import { UserModel } from "../../models/User";
import { generateToken } from "../../utils/jwt";
import { createSession } from "./shared";

export const verifyOtpController = new Elysia().post(
  "/",
  async ({ body, set, ...context }) => {
    const { email, code } = body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Find pending login record for this email
      const pendingLogin = await PendingLoginModel.findOne({
        email: normalizedEmail,
      })
        .lean()
        .exec();

      if (!pendingLogin) {
        set.status = 401;
        return { error: "Invalid or expired OTP" };
      }

      // Validate code matches
      if (pendingLogin.code !== code) {
        set.status = 401;
        return { error: "Invalid or expired OTP" };
      }

      // Validate not expired (TTL index may not have cleaned up yet)
      if (pendingLogin.expiresAt < new Date()) {
        await PendingLoginModel.deleteOne({ email: normalizedEmail });
        set.status = 401;
        return { error: "Invalid or expired OTP" };
      }

      // Find the user by email
      const user = await UserModel.findOne({ email: normalizedEmail }).exec();

      if (!user) {
        set.status = 401;
        return { error: "Invalid or expired OTP" };
      }

      if (!user.isActive) {
        set.status = 403;
        return { error: "Account is disabled" };
      }

      // Delete the pending login — consumed
      await PendingLoginModel.deleteOne({ email: normalizedEmail });

      // Update last login — use targeted updateOne to avoid Mongoose save() issues
      // with select:false Map fields (missedChats) on partially-loaded documents.
      await UserModel.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

      // Generate JWT
      const token = generateToken({
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
      });

      // Create session
      await createSession(
        user._id.toString(),
        token,
        { ...context, body, set } as Context
      );

      return {
        token,
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      set.status = 500;
      return {
        error: "Failed to verify OTP",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    body: t.Object({
      email: t.String({ format: "email" }),
      code: t.String({ minLength: 6, maxLength: 6 }),
    }),
  }
);
