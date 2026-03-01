import { Elysia, Context, t } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { UserModel } from "../../models/User";
import { Types } from "mongoose";

export const removeFriendController = new Elysia()
  .use(requireAuth)
  .delete("/", async (context) => {
    const { user, set, params } = context as Context & {
      user: AuthUser;
      params: { friendId: string };
    };

    try {
      const { friendId } = params;

      if (!Types.ObjectId.isValid(friendId)) {
        set.status = 400;
        return { error: "Invalid friend ID" };
      }

      // Validate the friendId user is in caller's friends array
      const currentUser = await UserModel.findById(user.userId).lean().exec();
      if (!currentUser) {
        set.status = 404;
        return { error: "User not found" };
      }

      const isFriend = currentUser.friends.some(
        (id) => id.toString() === friendId
      );
      if (!isFriend) {
        set.status = 404;
        return { error: "This user is not in your friends list" };
      }

      const friendObjId = new Types.ObjectId(friendId);
      const currentUserObjId = new Types.ObjectId(user.userId);

      // Remove from BOTH users' friends arrays atomically
      await Promise.all([
        UserModel.updateOne(
          { _id: currentUserObjId },
          { $pull: { friends: friendObjId } }
        ).exec(),
        UserModel.updateOne(
          { _id: friendObjId },
          { $pull: { friends: currentUserObjId } }
        ).exec(),
      ]);

      return { message: "Friend removed" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set.status = 500;
      return { error: "Failed to remove friend", message };
    }
  }, {
    params: t.Object({
      friendId: t.String(),
    }),
  });
