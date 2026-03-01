import { Elysia, t } from "elysia";
import { UserModel } from "../../models/User";
import { hashPassword } from "../../utils/hash";
import { UserRole } from "../../config/roles";
import { requireAdmin } from "../../middlewares/auth";

export const createUserController = new Elysia()
  .use(requireAdmin)
  .post("/", async ({ body, set }) => {
    const { username, email, password, role } = body;

    try {
      const existingUser = await UserModel.findOne({
        $or: [{ username }, { email }],
      });

      if (existingUser) {
        set.status = 409;
        return { error: "Username or email already exists" };
      }

      const hashedPassword = await hashPassword(password);

      const user = await UserModel.create({
        username,
        email,
        password: hashedPassword,
        role: role || UserRole.CUSTOMER,
      });

      return {
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        set.status = 500;
        return { error: "Failed to create user", message: error.message };
      }
      set.status = 500;
      return { error: "Failed to create user", message: "Unknown error" };
    }
  }, {
    body: t.Object({
      username: t.String({ minLength: 3, maxLength: 50 }),
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 8 }),
      role: t.Optional(t.String()),
    }),
  });

