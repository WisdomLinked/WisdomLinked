import { Elysia, Context, t } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { FriendInvitationModel } from "../../models/FriendInvitation";
import { UserModel } from "../../models/User";
import { ConversationModel } from "../../models/Conversation";
import { Types } from "mongoose";

export const acceptInvitationController = new Elysia()
  .use(requireAuth)
  .put("/", async (context) => {
    const { user, set, params } = context as Context & {
      user: AuthUser;
      params: { invitationId: string };
    };

    try {
      const { invitationId } = params;

      if (!Types.ObjectId.isValid(invitationId)) {
        set.status = 400;
        return { error: "Invalid invitation ID" };
      }

      const invitation = await FriendInvitationModel.findById(invitationId).exec();
      if (!invitation) {
        set.status = 404;
        return { error: "Invitation not found" };
      }

      // Validate caller is the receiver
      if (invitation.receiverId.toString() !== user.userId) {
        set.status = 403;
        return { error: "Only the invitation receiver can accept it" };
      }

      // Validate invitation is pending
      if (invitation.status !== "pending") {
        set.status = 409;
        return { error: `Invitation is already ${invitation.status}` };
      }

      // Update invitation status
      invitation.status = "accepted";
      await invitation.save();

      const senderId = invitation.senderId;
      const receiverId = invitation.receiverId;

      // Add each user to the other's friends array atomically
      await Promise.all([
        UserModel.updateOne(
          { _id: senderId },
          { $addToSet: { friends: receiverId } }
        ).exec(),
        UserModel.updateOne(
          { _id: receiverId },
          { $addToSet: { friends: senderId } }
        ).exec(),
      ]);

      // Auto-create a Conversation with both users as participants
      const conversation = await ConversationModel.create({
        participants: [senderId, receiverId],
      });

      return {
        message: "Friend request accepted",
        conversationId: conversation._id.toString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set.status = 500;
      return { error: "Failed to accept friend invitation", message };
    }
  }, {
    params: t.Object({
      invitationId: t.String(),
    }),
  });
