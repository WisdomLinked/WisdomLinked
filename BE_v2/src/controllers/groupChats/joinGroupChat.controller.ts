import { Context, Elysia, t } from "elysia";
import { isValidObjectId, Types } from "mongoose";
import { requireAuth, type AuthUser } from "../../middlewares/auth";
import { GroupChatModel } from "../../models/GroupChat";
import { UserModel } from "../../models/User";

type GroupChatParams = { groupChatId: string };

export const joinGroupChatController = new Elysia()
  .use(requireAuth)
  .post(
    "/",
    async (context) => {
      const { user, set } = context as Context & { user: AuthUser };
      const params = context.params as GroupChatParams;
      const { groupChatId } = params;

      try {
        if (!isValidObjectId(groupChatId)) {
          set.status = 400;
          return { error: "Invalid group chat ID" };
        }

        const groupChat = await GroupChatModel.findById(groupChatId);

        if (!groupChat) {
          set.status = 404;
          return { error: "Group chat not found" };
        }

        // Individual type must go through appointment flow
        if (groupChat.type === "individual") {
          set.status = 400;
          return { error: "Individual group chats require an appointment request" };
        }

        // Community that is not open requires invitation
        if (groupChat.type === "community" && !groupChat.isOpenToAll) {
          set.status = 403;
          return { error: "This community is invite-only" };
        }

        // Group must be accepting new members
        if (groupChat.status !== "active" && groupChat.status !== "pending") {
          set.status = 400;
          return { error: "Group chat is not accepting new members" };
        }

        const userId = user.userId;

        // User must not already be a participant
        const alreadyParticipant = groupChat.participants.some((p) => p.toString() === userId);
        if (alreadyParticipant) {
          set.status = 409;
          return { error: "Already a participant in this group chat" };
        }

        // Seminar with a price requires payment
        if (groupChat.type === "seminar" && groupChat.price !== undefined && groupChat.price > 0) {
          const hasPaid = groupChat.paidBy.some((p) => p.toString() === userId);
          if (!hasPaid) {
            set.status = 402;
            return { error: "Payment required to join this seminar" };
          }
        }

        const userObjectId = new Types.ObjectId(userId);

        await GroupChatModel.findByIdAndUpdate(groupChatId, {
          $addToSet: { participants: userObjectId },
        });

        await UserModel.findByIdAndUpdate(userId, {
          $addToSet: { groupChats: groupChat._id },
        });

        const updatedGroupChat = await GroupChatModel.findById(groupChatId)
          .populate("admin", "username image")
          .populate("participants", "username email image role");

        return { groupChat: updatedGroupChat };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to join group chat", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to join group chat", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        groupChatId: t.String(),
      }),
    }
  );
