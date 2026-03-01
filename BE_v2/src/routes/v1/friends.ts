import { Elysia } from "elysia";
import {
  listFriendsController,
  sendInvitationController,
  listInvitationsController,
  acceptInvitationController,
  rejectInvitationController,
  removeFriendController,
} from "../../controllers/friends";

export const friendRoutes = new Elysia({ prefix: "/api/v1/friends" })
  // GET /api/v1/friends — list friends
  .use(listFriendsController)
  // POST /api/v1/friends — send invitation
  .use(sendInvitationController)
  // GET /api/v1/friends/invitations — list invitations
  .use(new Elysia({ prefix: "/invitations" }).use(listInvitationsController))
  // PUT /api/v1/friends/:invitationId/accept
  .use(new Elysia({ prefix: "/:invitationId/accept" }).use(acceptInvitationController))
  // PUT /api/v1/friends/:invitationId/reject
  .use(new Elysia({ prefix: "/:invitationId/reject" }).use(rejectInvitationController))
  // DELETE /api/v1/friends/:friendId — remove friend
  .use(new Elysia({ prefix: "/:friendId" }).use(removeFriendController));
