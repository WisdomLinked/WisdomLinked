import { Elysia } from "elysia";
import {
  listAdminConversationsController,
  getAdminConversationMessagesController,
} from "../../controllers/adminChats";

export const adminChatsRoutes = new Elysia({ prefix: "/api/v1/admin/chats" })
  // GET /api/v1/admin/chats — list all conversations
  .use(listAdminConversationsController)
  // GET /api/v1/admin/chats/:conversationId/messages — get messages for a conversation
  .use(getAdminConversationMessagesController);
