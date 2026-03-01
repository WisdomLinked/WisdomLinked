import { Context, Elysia, t } from "elysia";
import { isValidObjectId } from "mongoose";
import { UserRole } from "../../config/roles";
import { requireAuth, type AuthUser } from "../../middlewares/auth";
import { GroupChatModel } from "../../models/GroupChat";

type GroupChatParams = { groupChatId: string };

export const cancelGroupChatController = new Elysia()
  .use(requireAuth)
  .put(
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

        // Caller must be the group admin or a system admin
        const isGroupAdmin = groupChat.admin.toString() === user.userId;
        const isSystemAdmin = user.role === UserRole.ADMIN;

        if (!isGroupAdmin && !isSystemAdmin) {
          set.status = 403;
          return { error: "Only the group admin can cancel this group chat" };
        }

        if (groupChat.status === "cancelled" || groupChat.status === "completed") {
          set.status = 400;
          return { error: `Group chat is already ${groupChat.status}` };
        }

        groupChat.status = "cancelled";
        await groupChat.save();

        return { groupChat };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to cancel group chat", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to cancel group chat", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        groupChatId: t.String(),
      }),
    }
  );
