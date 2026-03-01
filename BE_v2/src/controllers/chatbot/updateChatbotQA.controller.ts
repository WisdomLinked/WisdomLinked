import { Elysia, t } from "elysia";
import { Types } from "mongoose";
import { requireAdmin } from "../../middlewares/auth";
import { ChatBotQAModel } from "../../models/ChatBotQA";

type QAIdParams = { id: string };

export const updateChatbotQAController = new Elysia()
  .use(requireAdmin)
  .put("/:id", async ({ params, body, set }) => {
    const { id } = params as QAIdParams;

    if (!Types.ObjectId.isValid(id)) {
      set.status = 400;
      return { error: "Invalid ID" };
    }

    try {
      const updates: {
        question?: string;
        answer?: string;
        category?: string;
        isActive?: boolean;
      } = {};

      if (body.question !== undefined) updates.question = body.question;
      if (body.answer !== undefined) updates.answer = body.answer;
      if (body.category !== undefined) updates.category = body.category;
      if (body.isActive !== undefined) updates.isActive = body.isActive;

      const doc = await ChatBotQAModel.findByIdAndUpdate(id, updates, { new: true })
        .lean()
        .exec();

      if (!doc) {
        set.status = 404;
        return { error: "Chatbot Q&A not found" };
      }

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
      return { error: "Failed to update chatbot Q&A", message };
    }
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      question: t.Optional(t.String({ minLength: 1, maxLength: 1000 })),
      answer: t.Optional(t.String({ minLength: 1, maxLength: 5000 })),
      category: t.Optional(t.String({ maxLength: 100 })),
      isActive: t.Optional(t.Boolean()),
    }),
  });
