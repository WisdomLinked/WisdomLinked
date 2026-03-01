import { Elysia, Context, t } from "elysia";
import { UserModel, AuthMethod } from "../../models/User";
import { getSystemSettings } from "../../models/SystemSettings";
import { generateToken } from "../../utils/jwt";
import { verifyPassword } from "../../utils/hash";
import { logInfo } from "../../middlewares/logger";
import { createSession } from "./shared";

export const loginController = new Elysia()
  .post("/", async ({ body, set, ...context }) => {
    const { username, password } = body;

    try {
      // Check if local auth is enabled
      const settings = await getSystemSettings();
      if (!settings.loginMethods.local) {
        set.status = 403;
        return { error: "Password authentication is disabled" };
      }

      // Find user by username
      const user = await UserModel.findOne({ username }).select("+password");

      if (!user) {
        set.status = 401;
        return { error: "Invalid credentials" };
      }

      // Check if user is active
      if (!user.isActive) {
        set.status = 403;
        return { error: "Account is disabled" };
      }

      // Check if user has local auth method
      if (!user.authMethods.includes(AuthMethod.LOCAL) || !user.password) {
        set.status = 401;
        return { error: "Invalid credentials" };
      }

      // Verify password
      const isValid = await verifyPassword(user.password, password);

      if (!isValid) {
        set.status = 401;
        return { error: "Invalid credentials" };
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = generateToken({
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
      });

      // Create session
      await createSession(user._id.toString(), token, { ...context, body, set } as Context);

      await logInfo("User logged in", { username });

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
      if (error instanceof Error) {
        set.status = 500;
        return { error: "Failed to login", message: error.message };
      }
      set.status = 500;
      return { error: "Failed to login", message: "Unknown error" };
    }
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String(),
    }),
  });

