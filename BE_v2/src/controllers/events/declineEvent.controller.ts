import { Context, Elysia, t } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { EventModel } from "../../models/Event";
import { UserModel } from "../../models/User";
import { sendEventNotification } from "../../services/email";

export const declineEventController = new Elysia()
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

        if (!isParticipant) {
          set.status = 403;
          return { error: "Access denied: not a participant of this event" };
        }

        if (event.status !== "pending") {
          set.status = 400;
          return {
            error: `Cannot decline event with status "${event.status}". Only pending events can be declined.`,
          };
        }

        event.status = "declined";
        await event.save();

        // Notify the other party
        const notifyId =
          user.userId === expertId ? customerId : expertId;
        const otherParty = await UserModel.findById(notifyId).lean().exec();
        if (otherParty) {
          await sendEventNotification(otherParty.email, {
            title: event.title ?? "Event",
            date: event.start ? event.start.toISOString() : "TBD",
            expertName: user.username,
            status: "declined",
          });
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
        };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to decline event", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to decline event", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        eventId: t.String(),
      }),
    }
  );
