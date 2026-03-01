import { Elysia } from "elysia";
import {
  approveAppointmentController,
  cancelGroupChatController,
  createGroupChatController,
  getGroupChatController,
  getGroupMessagesController,
  joinGroupChatController,
  leaveGroupChatController,
  listGroupChatsController,
  requestAppointmentController,
  sendGroupMessageController,
} from "../../controllers/groupChats";

/**
 * Group Chat Routes
 *
 * All routes are protected by requireAuth (enforced inside each controller).
 *
 * POST   /api/v1/group-chats                                             — create
 * GET    /api/v1/group-chats                                             — list (with filters + pagination)
 * GET    /api/v1/group-chats/:groupChatId                                — detail
 * POST   /api/v1/group-chats/:groupChatId/join                           — join
 * POST   /api/v1/group-chats/:groupChatId/leave                          — leave
 * PUT    /api/v1/group-chats/:groupChatId/cancel                         — cancel
 * POST   /api/v1/group-chats/:groupChatId/appointment                    — request appointment
 * PUT    /api/v1/group-chats/:groupChatId/appointment/:appointmentId/approve — approve appointment
 * GET    /api/v1/group-chats/:groupChatId/messages                       — list messages
 * POST   /api/v1/group-chats/:groupChatId/messages                       — send message
 */
export const groupChatRoutes = new Elysia({ prefix: "/api/v1/group-chats" })
  // Root: create + list
  .use(createGroupChatController)
  .use(listGroupChatsController)
  // Per-group-chat routes nested under /:groupChatId
  .use(
    new Elysia({ prefix: "/:groupChatId" })
      .use(getGroupChatController)
      .use(new Elysia({ prefix: "/join" }).use(joinGroupChatController))
      .use(new Elysia({ prefix: "/leave" }).use(leaveGroupChatController))
      .use(new Elysia({ prefix: "/cancel" }).use(cancelGroupChatController))
      .use(
        new Elysia({ prefix: "/appointment" })
          .use(requestAppointmentController)
          .use(
            new Elysia({ prefix: "/:appointmentId/approve" }).use(
              approveAppointmentController
            )
          )
      )
      .use(
        new Elysia({ prefix: "/messages" })
          .use(getGroupMessagesController)
          .use(sendGroupMessageController)
      )
  );
