import { Elysia, t } from "elysia";
import { Types } from "mongoose";
import { requireAdmin } from "../../middlewares/auth";
import { ChatBotQAModel } from "../../models/ChatBotQA";

type QAIdParams = { id: string };

export const deleteChatbotQAController = new Elysia()
  .use(requireAdmin)
  .delete("/:id", async ({ params, set }) => {
    const { id } = params as QAIdParams;

    if (!Types.ObjectId.isValid(id)) {
      set.status = 400;
      return { error: "Invalid ID" };
    }

    try {
      const doc = await ChatBotQAModel.findByIdAndDelete(id);

      if (!doc) {
        set.status = 404;
        return { error: "Chatbot Q&A not found" };
      }

      return { message: "Chatbot Q&A deleted successfully" };
    } catch (error) {
      set.status = 500;
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: "Failed to delete chatbot Q&A", message };
    }
  }, {
    params: t.Object({ id: t.String() }),
  });
