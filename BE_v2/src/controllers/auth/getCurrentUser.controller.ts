import { Elysia, Context } from "elysia";
import { UserModel } from "../../models/User";
import { requireAuth } from "../../middlewares/auth";
import { AuthUser } from "../../middlewares/auth";

export const getCurrentUserController = new Elysia()
  .use(requireAuth)
  .get("/", async (context) => {
    const { user, set } = context as Context & { user: AuthUser };

    try {
      const foundUser = await UserModel.findById(user.userId);

      if (!foundUser) {
        set.status = 404;
        return { error: "User not found" };
      }

      return {
        user: {
          id: foundUser._id.toString(),
          username: foundUser.username,
          email: foundUser.email,
          role: foundUser.role,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        set.status = 500;
        return { error: "Failed to get user", message: error.message };
      }
      set.status = 500;
      return { error: "Failed to get user", message: "Unknown error" };
    }
  });

