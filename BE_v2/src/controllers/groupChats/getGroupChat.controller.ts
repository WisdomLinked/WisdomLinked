import { Context, Elysia, t } from "elysia";
import { isValidObjectId } from "mongoose";
import { requireAuth, type AuthUser } from "../../middlewares/auth";
import { GroupChatModel } from "../../models/GroupChat";
// Side-effect imports ensure Mongoose registers these models before populate() runs
import "../../models/Keyword";
import "../../models/Service";

type GroupChatParams = { groupChatId: string };

export const getGroupChatController = new Elysia()
  .use(requireAuth)
  .get(
    "/",
    async (context) => {
      const { set } = context as Context & { user: AuthUser };
      const params = context.params as GroupChatParams;
      const { groupChatId } = params;

      try {
        if (!isValidObjectId(groupChatId)) {
          set.status = 400;
          return { error: "Invalid group chat ID" };
        }

        const groupChat = await GroupChatModel.findById(groupChatId)
          .populate("admin", "username email image role")
          .populate("participants", "username email image role")
          .populate("keywords")
          .populate("services");

        if (!groupChat) {
          set.status = 404;
          return { error: "Group chat not found" };
        }

        return { groupChat };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to get group chat", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to get group chat", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        groupChatId: t.String(),
      }),
    }
  );
