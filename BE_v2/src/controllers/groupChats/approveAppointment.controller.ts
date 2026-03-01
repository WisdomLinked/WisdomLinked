import { Context, Elysia, t } from "elysia";
import { isValidObjectId } from "mongoose";
import { requireAuth, type AuthUser } from "../../middlewares/auth";
import { GroupChatModel } from "../../models/GroupChat";
import { PendingAppointmentToGroupModel } from "../../models/PendingAppointmentToGroup";
import { UserModel } from "../../models/User";

type AppointmentApprovalParams = {
  groupChatId: string;
  appointmentId: string;
};

export const approveAppointmentController = new Elysia()
  .use(requireAuth)
  .put(
    "/",
    async (context) => {
      const { user, set } = context as Context & { user: AuthUser };
      const params = context.params as AppointmentApprovalParams;
      const { groupChatId, appointmentId } = params;

      try {
        if (!isValidObjectId(groupChatId) || !isValidObjectId(appointmentId)) {
          set.status = 400;
          return { error: "Invalid ID provided" };
        }

        const groupChat = await GroupChatModel.findById(groupChatId);

        if (!groupChat) {
          set.status = 404;
          return { error: "Group chat not found" };
        }

        // Caller must be the group admin (the expert)
        if (groupChat.admin.toString() !== user.userId) {
          set.status = 403;
          return { error: "Only the group admin can approve appointments" };
        }

        const appointment = await PendingAppointmentToGroupModel.findById(appointmentId);

        if (!appointment) {
          set.status = 404;
          return { error: "Appointment not found" };
        }

        // Ensure the appointment belongs to this group chat
        if (appointment.groupChatId.toString() !== groupChatId) {
          set.status = 400;
          return { error: "Appointment does not belong to this group chat" };
        }

        const requestingUserId = appointment.userId;

        // Add the requesting user to groupChat participants
        await GroupChatModel.findByIdAndUpdate(groupChatId, {
          $addToSet: { participants: requestingUserId },
        });

        // Add the groupChat to the requesting user's groupChats array
        await UserModel.findByIdAndUpdate(requestingUserId, {
          $addToSet: { groupChats: groupChat._id },
        });

        // Activate the group chat if not already active
        if (groupChat.status !== "active") {
          await GroupChatModel.findByIdAndUpdate(groupChatId, { status: "active" });
        }

        // Delete the appointment record
        await PendingAppointmentToGroupModel.deleteOne({ _id: appointmentId });

        const updatedGroupChat = await GroupChatModel.findById(groupChatId)
          .populate("admin", "username image")
          .populate("participants", "username email image role");

        return { message: "Appointment approved", groupChat: updatedGroupChat };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to approve appointment", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to approve appointment", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        groupChatId: t.String(),
        appointmentId: t.String(),
      }),
    }
  );
