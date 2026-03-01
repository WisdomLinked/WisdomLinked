import { randomInt } from "crypto";
import { Elysia, t } from "elysia";
import { PendingLoginModel } from "../../models/PendingLogin";
import { UserModel } from "../../models/User";
import { sendLoginOtpEmail } from "../../services/email";

export const requestOtpController = new Elysia().post(
  "/",
  async ({ body, set }) => {
    const { email } = body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const user = await UserModel.findOne({ email: normalizedEmail }).lean().exec();

      if (user) {
        // Generate a 6-digit numeric code
        const code = String(randomInt(100000, 1000000));

        // 5-minute TTL
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Upsert: one pending login per email, replacing any existing one
        await PendingLoginModel.findOneAndUpdate(
          { email: normalizedEmail },
          { code, expiresAt, schemaVersion: 1 },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Fire-and-forget — email failure must not surface as an HTTP 500
        await sendLoginOtpEmail(normalizedEmail, code);
      }

      // Always return success — never reveal whether the email exists
      return { message: "OTP sent" };
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
