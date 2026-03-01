import { Elysia, Context, t } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { FriendInvitationModel } from "../../models/FriendInvitation";
import { UserModel } from "../../models/User";
import { Types } from "mongoose";

export const sendInvitationController = new Elysia()
  .use(requireAuth)
  .post("/", async (context) => {
    const { user, body, set } = context as Context & { user: AuthUser; body: { receiverId: string } };

    try {
      const { receiverId } = body;

      // Validate receiver is not the sender
      if (receiverId === user.userId) {
        set.status = 400;
        return { error: "Cannot send friend invitation to yourself" };
      }

      // Validate receiver ID is a valid ObjectId
      if (!Types.ObjectId.isValid(receiverId)) {
        set.status = 400;
        return { error: "Invalid receiver ID" };
      }

      // Validate receiver exists
      const receiver = await UserModel.findById(receiverId).lean().exec();
      if (!receiver) {
        set.status = 404;
        return { error: "Receiver not found" };
      }

      // Validate not already friends
      const sender = await UserModel.findById(user.userId).lean().exec();
      if (!sender) {
        set.status = 404;
        return { error: "Sender not found" };
      }

      const alreadyFriends = sender.friends.some(
        (id) => id.toString() === receiverId
      );
      if (alreadyFriends) {
        set.status = 409;
        return { error: "You are already friends with this user" };
      }

      // Validate no existing invitation between this pair (either direction)
      const senderObjId = new Types.ObjectId(user.userId);
      const receiverObjId = new Types.ObjectId(receiverId);

      const existingInvitation = await FriendInvitationModel.findOne({
        $or: [
          { senderId: senderObjId, receiverId: receiverObjId },
          { senderId: receiverObjId, receiverId: senderObjId },
        ],
        status: "pending",
      })
        .lean()
        .exec();

      if (existingInvitation) {
        set.status = 409;
        return { error: "A pending friend invitation already exists between you and this user" };
      }

      // Create the invitation
      const invitation = await FriendInvitationModel.create({
        senderId: senderObjId,
        receiverId: receiverObjId,
        status: "pending",
      });

      return {
        invitation: {
          id: invitation._id.toString(),
          senderId: invitation.senderId.toString(),
          receiverId: invitation.receiverId.toString(),
          status: invitation.status,
          createdAt: invitation.createdAt,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set.status = 500;
      return { error: "Failed to send friend invitation", message };
    }
  }, {
    body: t.Object({
      receiverId: t.String(),
    }),
  });
