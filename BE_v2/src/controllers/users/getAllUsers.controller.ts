import { Elysia } from "elysia";
import { UserModel } from "../../models/User";
import { requireAdmin } from "../../middlewares/auth";

export const getAllUsersController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const users = await UserModel.find().sort({ createdAt: -1 });

      return {
        users: users.map((user) => ({
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        })),
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to fetch users", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to fetch users", message: "Unknown error" };
    }
  });

