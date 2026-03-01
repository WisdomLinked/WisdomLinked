import { Elysia, Context } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { ConversationModel } from "../../models/Conversation";
import { Types } from "mongoose";

export const listConversationsController = new Elysia()
  .use(requireAuth)
  .get("/", async (context) => {
    const { user, set } = context as Context & { user: AuthUser };

    try {
      const userId = new Types.ObjectId(user.userId);

      const conversations = await ConversationModel.find({
        participants: userId,
      })
        .populate("participants", "username email image")
        .populate("lastMessage", "content author createdAt")
        .sort({ updatedAt: -1 })
        .lean()
        .exec();

      const mapped = conversations.map((conv) => ({
        id: conv._id.toString(),
        participants: conv.participants,
        lastMessage: conv.lastMessage ?? null,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }));

      return { conversations: mapped };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set.status = 500;
      return { error: "Failed to list conversations", message };
    }
  });
