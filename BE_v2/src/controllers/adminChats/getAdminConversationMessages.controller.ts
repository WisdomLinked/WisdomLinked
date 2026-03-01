import { Elysia, t } from "elysia";
import { Types } from "mongoose";
import { requireAdmin } from "../../middlewares/auth";
import { ConversationModel } from "../../models/Conversation";
import { MessageModel } from "../../models/Message";

type ConversationIdParams = { conversationId: string };

export const getAdminConversationMessagesController = new Elysia()
  .use(requireAdmin)
  .get("/:conversationId/messages", async (context) => {
    const { conversationId } = context.params as ConversationIdParams;
    const { page = 1, limit = 20 } = context.query;

    if (!Types.ObjectId.isValid(conversationId)) {
      context.set.status = 400;
      return { error: "Invalid conversation ID" };
    }

    try {
      const conversation = await ConversationModel.findById(conversationId)
        .lean()
        .exec();

      if (!conversation) {
        context.set.status = 404;
        return { error: "Conversation not found" };
      }

      const pageNum = Math.max(1, page);
      const limitNum = Math.min(100, Math.max(1, limit));
      const skip = (pageNum - 1) * limitNum;

      const convObjId = new Types.ObjectId(conversationId);

      const [messages, total] = await Promise.all([
        MessageModel.find({ conversationId: convObjId })
          .sort({ createdAt: 1 })
          .skip(skip)
          .limit(limitNum)
          .populate("author", "username")
          .lean()
          .exec(),
        MessageModel.countDocuments({ conversationId: convObjId }),
      ]);

      return {
        data: messages.map((msg) => ({
          id: msg._id.toString(),
          author: msg.author,
          content: msg.content,
          type: msg.type,
          fileUrl: msg.fileUrl,
          createdAt: msg.createdAt,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      context.set.status = 500;
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: "Failed to get conversation messages", message };
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
