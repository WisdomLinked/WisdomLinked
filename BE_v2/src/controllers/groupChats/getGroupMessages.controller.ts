import { Elysia, t } from "elysia";
import { isValidObjectId } from "mongoose";
import { requireAuth, type AuthUser } from "../../middlewares/auth";
import { GroupChatModel } from "../../models/GroupChat";
import { MessageModel } from "../../models/Message";

type GroupChatParams = { groupChatId: string };

export const getGroupMessagesController = new Elysia()
  .use(requireAuth)
  .get(
    "/",
    async (context) => {
      // Extract user via minimal type cast to avoid Context query-type conflict
      const user = (context as { user: AuthUser }).user;
      const { set } = context;
      const params = context.params as GroupChatParams;
      const { groupChatId } = params;
      const { page = 1, limit = 20 } = context.query as { page?: number; limit?: number };

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

        // Caller must be a participant in this group chat
        const isParticipant = groupChat.participants.some((p) => p.toString() === user.userId);
        if (!isParticipant) {
          set.status = 403;
          return { error: "You are not a participant in this group chat" };
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;

        const [messages, total] = await Promise.all([
          MessageModel.find({ groupChatId: groupChat._id })
            .populate("author", "username image")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
          MessageModel.countDocuments({ groupChatId: groupChat._id }),
        ]);

        return {
          messages,
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
        };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to get messages", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to get messages", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        groupChatId: t.String(),
      }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      }),
    }
  );
