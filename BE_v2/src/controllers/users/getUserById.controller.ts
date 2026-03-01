import { Context, Elysia, t } from "elysia";
import { UserModel } from "../../models/User";
import { requireAdmin } from "../../middlewares/auth";

type UserIdParams = { id: string };

export const getUserByIdController = new Elysia()
  .use(requireAdmin)
  .get("/:id", async (context) => {
    const { params } = context as Context & { params: UserIdParams };

    try {
      const { id } = params;
      const user = await UserModel.findById(id);

      if (!user) {
        context.set.status = 404;
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
        context.set.status = 500;
        return { error: "Failed to fetch user", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to fetch user", message: "Unknown error" };
    }
  }, {
    params: t.Object({
      id: t.String(),
    }),
  });

