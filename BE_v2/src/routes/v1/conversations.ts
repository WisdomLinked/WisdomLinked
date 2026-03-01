import { Elysia } from "elysia";
import {
  listConversationsController,
  getConversationController,
  getMessagesController,
  sendMessageController,
  uploadChatFileController,
} from "../../controllers/conversations";

export const conversationRoutes = new Elysia({ prefix: "/api/v1/conversations" })
  // GET /api/v1/conversations — list conversations
  .use(listConversationsController)
  // GET /api/v1/conversations/:conversationId — get conversation detail
  .use(new Elysia({ prefix: "/:conversationId" }).use(getConversationController))
  // GET /api/v1/conversations/:conversationId/messages — list messages
  .use(new Elysia({ prefix: "/:conversationId/messages" }).use(getMessagesController))
  // POST /api/v1/conversations/:conversationId/messages — send message
  .use(new Elysia({ prefix: "/:conversationId/messages" }).use(sendMessageController))
  // POST /api/v1/conversations/:conversationId/upload — upload a file for a conversation
  .use(new Elysia({ prefix: "/:conversationId/upload" }).use(uploadChatFileController));
