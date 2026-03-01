import { Elysia, Context, t } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { ConversationModel } from "../../models/Conversation";
import { Types } from "mongoose";

export const getConversationController = new Elysia()
  .use(requireAuth)
  .get("/", async (context) => {
    const { user, set, params } = context as Context & {
      user: AuthUser;
      params: { conversationId: string };
    };

    try {
      const { conversationId } = params;

      if (!Types.ObjectId.isValid(conversationId)) {
        set.status = 400;
        return { error: "Invalid conversation ID" };
      }

      const convId = new Types.ObjectId(conversationId);

      // Find conversation by ID first to distinguish 404 from 403
      const exists = await ConversationModel.exists({ _id: convId }).exec();
      if (!exists) {
        set.status = 404;
        return { error: "Conversation not found" };
      }

      // Check participant membership via native DB filter — avoids boundary type cast
      const isParticipantRecord = await ConversationModel.exists({
        _id: convId,
        participants: new Types.ObjectId(user.userId),
      }).exec();

      if (!isParticipantRecord) {
        set.status = 403;
        return { error: "You are not a participant in this conversation" };
      }

      // Fetch full conversation with populated participants for response
      const conversation = await ConversationModel.findById(convId)
        .populate("participants", "username email image")
        .lean()
        .exec();

      if (!conversation) {
        set.status = 404;
        return { error: "Conversation not found" };
      }

      return {
        conversation: {
          id: conversation._id.toString(),
          participants: conversation.participants,
          lastMessage: conversation.lastMessage ?? null,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set.status = 500;
      return { error: "Failed to get conversation", message };
    }
  }, {
    params: t.Object({
      conversationId: t.String(),
    }),
  });
