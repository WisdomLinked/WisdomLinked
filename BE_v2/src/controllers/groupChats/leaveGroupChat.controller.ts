import { Context, Elysia, t } from "elysia";
import { isValidObjectId, Types } from "mongoose";
import { requireAuth, type AuthUser } from "../../middlewares/auth";
import { GroupChatModel } from "../../models/GroupChat";
import { UserModel } from "../../models/User";

type GroupChatParams = { groupChatId: string };

export const leaveGroupChatController = new Elysia()
  .use(requireAuth)
  .post(
    "/",
    async (context) => {
      const { user, set } = context as Context & { user: AuthUser };
      const params = context.params as GroupChatParams;
      const { groupChatId } = params;

      try {
        if (!isValidObjectId(groupChatId)) {
          set.status = 400;
          return { error: "Invalid group chat ID" };
        }

        const groupChat = await GroupChatModel.findById(groupChatId);

        if (!groupChat) {
          set.status = 404;
          return { error: "Group chat not found" };
        }

        const userId = user.userId;

        // Admin cannot leave their own group chat
        if (groupChat.admin.toString() === userId) {
          set.status = 403;
          return { error: "Admin cannot leave the group chat" };
        }

        // Must be a participant to leave
        const isParticipant = groupChat.participants.some((p) => p.toString() === userId);
        if (!isParticipant) {
          set.status = 400;
          return { error: "Not a participant in this group chat" };
        }

        const userObjectId = new Types.ObjectId(userId);

        await GroupChatModel.findByIdAndUpdate(groupChatId, {
          $pull: { participants: userObjectId },
        });

        await UserModel.findByIdAndUpdate(userId, {
          $pull: { groupChats: groupChat._id },
        });

        return { message: "Left group chat" };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to leave group chat", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to leave group chat", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        groupChatId: t.String(),
      }),
    }
  );
