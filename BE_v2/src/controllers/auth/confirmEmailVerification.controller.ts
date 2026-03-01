import { Context, Elysia, t } from "elysia";
import { PendingUserModel } from "../../models/PendingUser";
import { UserModel, AuthMethod } from "../../models/User";
import { generateToken } from "../../utils/jwt";
import { sendWelcomeEmail } from "../../services/email";
import { createSession } from "./shared";

export const confirmEmailVerificationController = new Elysia().post(
  "/",
  async ({ body, set, ...context }) => {
    const { email, code } = body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Find pending user by email
      const pendingUser = await PendingUserModel.findOne({
        email: normalizedEmail,
      })
        .lean()
        .exec();

      if (!pendingUser) {
        set.status = 400;
        return { error: "No pending verification for this email" };
      }

      // Validate code matches
      if (pendingUser.verificationCode !== code) {
        set.status = 400;
        return { error: "Invalid verification code" };
      }

      // Validate not expired
      if (pendingUser.expiresAt < new Date()) {
        await PendingUserModel.deleteOne({ email: normalizedEmail });
        set.status = 400;
        return { error: "Verification code expired. Please register again" };
      }

      // Guard against duplicate registration if another request beat us here
      const existingUser = await UserModel.findOne({
        $or: [
          { username: pendingUser.username },
          { email: normalizedEmail },
        ],
      })
        .lean()
        .exec();

      if (existingUser) {
        set.status = 409;
        return { error: "Username or email already registered" };
      }

      // Create the real user from pending data
      const user = await UserModel.create({
        username: pendingUser.username,
        email: normalizedEmail,
        password: pendingUser.password,
        role: pendingUser.role,
        authMethods: [AuthMethod.LOCAL],
        isActive: true,
        status: "active",
      });

      // Delete the consumed pending user record
      await PendingUserModel.deleteOne({ email: normalizedEmail });

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

      // Send welcome email — fire-and-forget
      await sendWelcomeEmail(user.email, user.username);

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
        error: "Failed to confirm email verification",
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
