import { randomInt } from "crypto";
import { Elysia, t } from "elysia";
import { PendingUserModel } from "../../models/PendingUser";
import { UserModel } from "../../models/User";
import { UserRole } from "../../config/roles";
import { hashPassword } from "../../utils/hash";
import { sendVerificationEmail } from "../../services/email";

export const requestEmailVerificationController = new Elysia().post(
  "/",
  async ({ body, set }) => {
    const { username, email, password, role } = body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Validate role is not admin
      if (role !== UserRole.CUSTOMER && role !== UserRole.EXPERT) {
        set.status = 400;
        return { error: "Invalid role. Must be customer or expert" };
      }

      // Check if a real user already exists with this email or username
      const existingUser = await UserModel.findOne({
        $or: [{ username }, { email: normalizedEmail }],
      })
        .lean()
        .exec();

      if (existingUser) {
        set.status = 409;
        return { error: "Username or email already registered" };
      }

      // Hash password before storing in PendingUser
      const hashedPassword = await hashPassword(password);

      // Generate 6-digit verification code
      const verificationCode = String(randomInt(100000, 1000000));

      // 24-hour TTL for email verification
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Upsert PendingUser — one pending registration per email
      await PendingUserModel.findOneAndUpdate(
        { email: normalizedEmail },
        {
          username,
          password: hashedPassword,
          role,
          verificationCode,
          expiresAt,
          schemaVersion: 1,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Send verification email — fire-and-forget
      await sendVerificationEmail(normalizedEmail, verificationCode);

      return { message: "Verification email sent" };
    } catch (error) {
      set.status = 500;
      return {
        error: "Failed to send verification email",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    body: t.Object({
      username: t.String({ minLength: 3, maxLength: 50 }),
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 8 }),
      role: t.Union([t.Literal("customer"), t.Literal("expert")]),
    }),
  }
);
