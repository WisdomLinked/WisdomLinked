import { Elysia, t } from "elysia";
import { requireAdmin } from "../../middlewares/auth";
import { ConversationModel } from "../../models/Conversation";
import { UserModel } from "../../models/User";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const listAdminConversationsController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const { page = 1, limit = 20, search } = context.query;

      const pageNum = Math.max(1, page);
      const limitNum = Math.min(100, Math.max(1, limit));
      const skip = (pageNum - 1) * limitNum;

      if (search !== undefined && search.trim().length > 0) {
        const safe = escapeRegex(search.trim());

        // Find users whose username matches the search term
        const matchingUsers = await UserModel.find(
          { username: { $regex: safe, $options: "i" } },
          { _id: 1 }
        )
          .lean()
          .exec();

        const userIds = matchingUsers.map((u) => u._id);
        const filter = { participants: { $in: userIds } };

        const [conversations, total] = await Promise.all([
          ConversationModel.find(filter)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate("participants", "username email")
            .populate("lastMessage", "content type createdAt")
            .lean()
            .exec(),
          ConversationModel.countDocuments(filter),
        ]);

        return {
          data: conversations.map((conv) => ({
            id: conv._id.toString(),
            participants: conv.participants,
            lastMessage: conv.lastMessage,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        };
      }

      const [conversations, total] = await Promise.all([
        ConversationModel.find()
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate("participants", "username email")
          .populate("lastMessage", "content type createdAt")
          .lean()
          .exec(),
        ConversationModel.countDocuments(),
      ]);

      return {
        data: conversations.map((conv) => ({
          id: conv._id.toString(),
          participants: conv.participants,
          lastMessage: conv.lastMessage,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
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
      return { error: "Failed to list conversations", message };
    }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      search: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    }),
  });
