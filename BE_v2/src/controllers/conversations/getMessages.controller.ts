import { Elysia, Context, t } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { ConversationModel } from "../../models/Conversation";
import { MessageModel } from "../../models/Message";
import { Types } from "mongoose";

export const getMessagesController = new Elysia()
  .use(requireAuth)
  .get("/", async (context) => {
    const { user, set, params } = context as Context & {
      user: AuthUser;
      params: { conversationId: string };
    };

    const { page = 1, limit = 20 } = context.query as {
      page?: number;
      limit?: number;
    };

    try {
      const { conversationId } = params;

      if (!Types.ObjectId.isValid(conversationId)) {
        set.status = 400;
        return { error: "Invalid conversation ID" };
      }

      const conversation = await ConversationModel.findById(conversationId)
        .lean()
        .exec();

      if (!conversation) {
        set.status = 404;
        return { error: "Conversation not found" };
      }

      // Validate caller is a participant
      const isParticipant = conversation.participants.some(
        (p) => p.toString() === user.userId
      );
      if (!isParticipant) {
        set.status = 403;
        return { error: "You are not a participant in this conversation" };
      }

      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(100, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * limitNum;

      const convObjId = new Types.ObjectId(conversationId);

      const [messages, total] = await Promise.all([
        MessageModel.find({ conversationId: convObjId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate("author", "username image")
          .lean()
          .exec(),
        MessageModel.countDocuments({ conversationId: convObjId }),
      ]);

      const totalPages = Math.ceil(total / limitNum);

      return {
        messages: messages.map((msg) => ({
          id: msg._id.toString(),
          author: msg.author,
          content: msg.content,
          type: msg.type,
          conversationId: conversationId,
          fileUrl: msg.fileUrl,
          createdAt: msg.createdAt,
        })),
        total,
        page: pageNum,
        totalPages,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set.status = 500;
      return { error: "Failed to get messages", message };
    }
  }, {
    params: t.Object({
      conversationId: t.String(),
    }),
    query: t.Object({
      page: t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
  });
