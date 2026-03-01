import { Context, Elysia, t } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { EventModel } from "../../models/Event";
import { UserModel } from "../../models/User";
import { UserRole } from "../../config/roles";
import { sendEventNotification } from "../../services/email";

export const cancelEventController = new Elysia()
  .use(requireAuth)
  .put(
    "/",
    async (context) => {
      const { user, set, params } = context as Context & {
        user: AuthUser;
        params: { eventId: string };
      };

      try {
        const event = await EventModel.findById(params.eventId).exec();
        if (!event) {
          set.status = 404;
          return { error: "Event not found" };
        }

        const expertId = event.expert.toString();
        const customerId = event.customer.toString();
        const isParticipant =
          expertId === user.userId || customerId === user.userId;
        const isAdmin = user.role === UserRole.ADMIN;

        if (!isParticipant && !isAdmin) {
          set.status = 403;
          return { error: "Access denied: not a participant of this event" };
        }

        if (event.status !== "pending" && event.status !== "accepted") {
          set.status = 400;
          return {
            error: `Cannot cancel event with status "${event.status}". Only pending or accepted events can be cancelled.`,
          };
        }

        const wasPaid = event.paidBy !== undefined && event.paidBy !== null;
        event.status = "cancelled";
        await event.save();

        // Notify all participants
        const notifyIds = [expertId, customerId].filter(
          (id) => id !== user.userId
        );
        for (const notifyId of notifyIds) {
          const participant = await UserModel.findById(notifyId).lean().exec();
          if (participant) {
            await sendEventNotification(participant.email, {
              title: event.title ?? "Event",
              date: event.start ? event.start.toISOString() : "TBD",
              expertName: user.username,
              status: "cancelled",
            });
          }
        }

        return {
          event: {
            id: event._id.toString(),
            expert: expertId,
            customer: customerId,
            start: event.start,
            end: event.end,
            duration: event.duration,
            title: event.title,
            status: event.status,
            price: event.price,
            totalTimeSpent: event.totalTimeSpent,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
          },
          ...(wasPaid ? { refundRequested: true } : {}),
        };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to cancel event", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to cancel event", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        eventId: t.String(),
      }),
    }
  );
