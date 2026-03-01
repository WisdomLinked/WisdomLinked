import { Elysia, Context, t } from "elysia";
import { UserModel, AuthMethod } from "../../models/User";
import { getSystemSettings } from "../../models/SystemSettings";
import { generateToken } from "../../utils/jwt";
import { hashPassword } from "../../utils/hash";
import { UserRole } from "../../config/roles";
import { logInfo } from "../../middlewares/logger";
import { createSession } from "./shared";

export const registerController = new Elysia()
  .post("/", async ({ body, set, ...context }) => {
    const { username, email, password } = body;

    try {
      // Check if registration is enabled
      const settings = await getSystemSettings();
      if (!settings.registrationEnabled) {
        set.status = 403;
        return { error: "Registration is currently disabled" };
      }

      // Check if local auth is enabled
      if (!settings.loginMethods.local) {
        set.status = 403;
        return { error: "Password authentication is disabled" };
      }

      // Check if user already exists
      const existingUser = await UserModel.findOne({
        $or: [{ username }, { email }],
      });

      if (existingUser) {
        set.status = 409;
        return { error: "Username or email already exists" };
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await UserModel.create({
        username,
        email,
        password: hashedPassword,
        role: UserRole.CUSTOMER,
        authMethods: [AuthMethod.LOCAL],
        isActive: true,
      });

      // Generate token
      const token = generateToken({
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
      });

      // Create session
      await createSession(user._id.toString(), token, { ...context, body, set } as Context);

      await logInfo("User registered", { username, email });

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
        return { error: "Failed to register user", message: error.message };
      }
      set.status = 500;
      return { error: "Failed to register user", message: "Unknown error" };
    }
  }, {
    body: t.Object({
      username: t.String({ minLength: 3, maxLength: 50 }),
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 8 }),
    }),
  });

