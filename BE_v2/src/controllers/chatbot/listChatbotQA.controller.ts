import { Elysia, t } from "elysia";
import { requireAdmin } from "../../middlewares/auth";
import { ChatBotQAModel } from "../../models/ChatBotQA";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type QASearchFilter = {
  $or?: Array<
    | { question: { $regex: string; $options: "i" } }
    | { answer: { $regex: string; $options: "i" } }
  >;
  isActive?: boolean;
};

export const listChatbotQAController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const { page = 1, limit = 20, search, isActive } = context.query;

      const filter: QASearchFilter = {};

      if (search !== undefined && search.trim().length > 0) {
        const safe = escapeRegex(search.trim());
        filter.$or = [
          { question: { $regex: safe, $options: "i" } },
          { answer: { $regex: safe, $options: "i" } },
        ];
      }

      if (isActive !== undefined) {
        filter.isActive = isActive === "true";
      }

      const pageNum = Math.max(1, page);
      const limitNum = Math.min(100, Math.max(1, limit));
      const skip = (pageNum - 1) * limitNum;

      const [data, total] = await Promise.all([
        ChatBotQAModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        ChatBotQAModel.countDocuments(filter),
      ]);

      return {
        data: data.map((item) => ({
          id: item._id.toString(),
          question: item.question,
          answer: item.answer,
          category: item.category,
          isActive: item.isActive,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
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
      return { error: "Failed to list chatbot Q&A", message };
    }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      search: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
      isActive: t.Optional(t.Union([t.Literal("true"), t.Literal("false")])),
    }),
  });
