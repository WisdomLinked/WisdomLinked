import { Elysia, t } from "elysia";
import { requireAdmin } from "../../middlewares/auth";
import { ChatBotQAModel } from "../../models/ChatBotQA";

export const createChatbotQAController = new Elysia()
  .use(requireAdmin)
  .post("/", async ({ body, set }) => {
    try {
      const { question, answer, category, isActive } = body;

      const doc = await ChatBotQAModel.create({
        question,
        answer,
        category,
        isActive: isActive ?? true,
      });

      return {
        data: {
          id: doc._id.toString(),
          question: doc.question,
          answer: doc.answer,
          category: doc.category,
          isActive: doc.isActive,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        },
      };
    } catch (error) {
      set.status = 500;
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: "Failed to create chatbot Q&A", message };
    }
  }, {
    body: t.Object({
      question: t.String({ minLength: 1, maxLength: 1000 }),
      answer: t.String({ minLength: 1, maxLength: 5000 }),
      category: t.Optional(t.String({ maxLength: 100 })),
      isActive: t.Optional(t.Boolean()),
    }),
  });
