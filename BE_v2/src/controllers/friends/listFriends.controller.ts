import { Elysia, Context } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { UserModel } from "../../models/User";

export const listFriendsController = new Elysia()
  .use(requireAuth)
  .get("/", async (context) => {
    const { user, set } = context as Context & { user: AuthUser };

    try {
      // Fetch the current user's friends IDs
      const currentUser = await UserModel.findById(user.userId)
        .select("friends")
        .lean()
        .exec();

      if (!currentUser) {
        set.status = 404;
        return { error: "User not found" };
      }

      // Query friend details separately — avoids type-unsafe populate boundary cast
      const friends = await UserModel.find(
        { _id: { $in: currentUser.friends } },
        "username email image status role"
      )
        .lean()
        .exec();

      return {
        friends: friends.map((friend) => ({
          id: friend._id.toString(),
          username: friend.username,
          email: friend.email,
          image: friend.image,
          status: friend.status,
          role: friend.role,
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set.status = 500;
      return { error: "Failed to list friends", message };
    }
  });
