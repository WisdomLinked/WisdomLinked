import { Context, Elysia } from "elysia";
import { AuthUser, requireAuth } from "../../middlewares/auth";
import { UserModel } from "../../models/User";

export const getProfileController = new Elysia()
  .use(requireAuth)
  .get("/", async (context) => {
    const { user, set } = context as Context & { user: AuthUser };

    try {
      const foundUser = await UserModel.findById(user.userId)
        .populate("keywords", "name")
        .populate("services", "name")
        .lean()
        .exec();

      if (!foundUser) {
        set.status = 404;
        return { error: "User not found" };
      }

      return { user: foundUser };
    } catch (error) {
      set.status = 500;
      return {
        error: "Failed to get profile",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
