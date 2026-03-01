import { Elysia, t } from "elysia";
import { UserModel } from "../../models/User";
import { requireAdmin } from "../../middlewares/auth";

type UserIdParams = { id: string };

export const updateUserController = new Elysia()
  .use(requireAdmin)
  .put("/:id", async ({ params, body, set }) => {
    const { id } = params as UserIdParams;
    const { username, email, role } = body;

    try {
      const updates: { username?: string; email?: string; role?: string } = {};
      if (username) updates.username = username;
      if (email) updates.email = email;
      if (role) updates.role = role;

      const user = await UserModel.findByIdAndUpdate(id, updates, { new: true });

      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

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
        return { error: "Failed to update user", message: error.message };
      }
      set.status = 500;
      return { error: "Failed to update user", message: "Unknown error" };
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Object({
      username: t.Optional(t.String({ minLength: 3, maxLength: 50 })),
      email: t.Optional(t.String({ format: "email" })),
      role: t.Optional(t.String()),
    }),
  });

