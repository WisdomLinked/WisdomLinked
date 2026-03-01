import { Elysia } from "elysia";
import {
  listChatbotQAController,
  createChatbotQAController,
  updateChatbotQAController,
  deleteChatbotQAController,
} from "../../controllers/chatbot";

export const chatbotRoutes = new Elysia({ prefix: "/api/v1/chatbot" })
  // GET /api/v1/chatbot — list Q&A entries
  .use(listChatbotQAController)
  // POST /api/v1/chatbot — create Q&A entry
  .use(createChatbotQAController)
  // PUT /api/v1/chatbot/:id — update Q&A entry
  .use(updateChatbotQAController)
  // DELETE /api/v1/chatbot/:id — delete Q&A entry
  .use(deleteChatbotQAController);
