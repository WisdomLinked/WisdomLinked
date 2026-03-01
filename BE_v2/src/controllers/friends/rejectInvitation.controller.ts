import { Elysia, Context, t } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { FriendInvitationModel } from "../../models/FriendInvitation";
import { Types } from "mongoose";

export const rejectInvitationController = new Elysia()
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
        return { error: "Only the invitation receiver can reject it" };
      }

      // Validate invitation is pending
      if (invitation.status !== "pending") {
        set.status = 409;
        return { error: `Invitation is already ${invitation.status}` };
      }

      // Update status to rejected
      invitation.status = "rejected";
      await invitation.save();

      return {
        invitation: {
          id: invitation._id.toString(),
          senderId: invitation.senderId.toString(),
          receiverId: invitation.receiverId.toString(),
          status: invitation.status,
          updatedAt: invitation.updatedAt,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set.status = 500;
      return { error: "Failed to reject friend invitation", message };
    }
  }, {
    params: t.Object({
      invitationId: t.String(),
    }),
  });
