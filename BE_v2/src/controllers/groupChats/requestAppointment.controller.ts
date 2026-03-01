import { Context, Elysia, t } from "elysia";
import { isValidObjectId, Types } from "mongoose";
import { UserRole } from "../../config/roles";
import { requireAuth, type AuthUser } from "../../middlewares/auth";
import { GroupChatModel } from "../../models/GroupChat";
import { PendingAppointmentToGroupModel } from "../../models/PendingAppointmentToGroup";

type GroupChatParams = { groupChatId: string };

export const requestAppointmentController = new Elysia()
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

        // Only customers can request appointments
        if (user.role !== UserRole.CUSTOMER) {
          set.status = 403;
          return { error: "Only customers can request appointments" };
        }

        const groupChat = await GroupChatModel.findById(groupChatId);

        if (!groupChat) {
          set.status = 404;
          return { error: "Group chat not found" };
        }

        // Must be an individual type group chat
        if (groupChat.type !== "individual") {
          set.status = 400;
          return { error: "Appointments are only for individual group chats" };
        }

        const userObjectId = new Types.ObjectId(user.userId);

        // No existing pending appointment for this user+group combination
        const existingAppointment = await PendingAppointmentToGroupModel.findOne({
          userId: userObjectId,
          groupChatId: groupChat._id,
        });

        if (existingAppointment) {
          set.status = 409;
          return { error: "A pending appointment already exists for this group chat" };
        }

        const appointment = await PendingAppointmentToGroupModel.create({
          userId: userObjectId,
          groupChatId: groupChat._id,
          status: "pending",
        });

        return { appointment };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to request appointment", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to request appointment", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        groupChatId: t.String(),
      }),
    }
  );
