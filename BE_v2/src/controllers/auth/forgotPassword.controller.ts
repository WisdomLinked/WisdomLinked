import { randomInt } from "crypto";
import { Elysia, t } from "elysia";
import { PendingPasswordResetModel } from "../../models/PendingPasswordReset";
import { UserModel } from "../../models/User";
import { sendPasswordResetEmail } from "../../services/email";

export const forgotPasswordController = new Elysia().post(
  "/",
  async ({ body, set }) => {
    const { email } = body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const user = await UserModel.findOne({ email: normalizedEmail }).lean().exec();

      if (user) {
        // Generate 6-digit reset code
        const code = String(randomInt(100000, 1000000));

        // 15-minute TTL
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Upsert PendingPasswordReset — one per email
        await PendingPasswordResetModel.findOneAndUpdate(
          { email: normalizedEmail },
          { code, expiresAt, schemaVersion: 1 },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Fire-and-forget
        await sendPasswordResetEmail(normalizedEmail, code);
      }

      // Always return success — never reveal whether the email exists
      return { message: "Reset email sent" };
    } catch (error) {
      set.status = 500;
      return {
        error: "Failed to process request",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    body: t.Object({
      email: t.String({ format: "email" }),
    }),
  }
);
