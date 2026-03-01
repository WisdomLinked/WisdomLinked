import { Context, Elysia, t } from "elysia";
import { Types } from "mongoose";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { EventModel } from "../../models/Event";
import { UserRole } from "../../config/roles";

interface EventParticipant {
  _id: Types.ObjectId;
  username: string;
  email: string;
  image?: string;
  title?: string;
}

export const getEventController = new Elysia()
  .use(requireAuth)
  .get(
    "/",
    async (context) => {
      const { user, set, params } = context as Context & {
        user: AuthUser;
        params: { eventId: string };
      };

      try {
        const event = await EventModel.findById(params.eventId)
          .populate<{ expert: EventParticipant; customer: EventParticipant }>([
            { path: "expert", select: "username email image title" },
            { path: "customer", select: "username email image" },
          ])
          .lean()
          .exec();

        if (!event) {
          set.status = 404;
          return { error: "Event not found" };
        }

        const expertId = event.expert._id.toString();
        const customerId = event.customer._id.toString();
        const isParticipant =
          expertId === user.userId || customerId === user.userId;
        const isAdmin = user.role === UserRole.ADMIN;

        if (!isParticipant && !isAdmin) {
          set.status = 403;
          return { error: "Access denied: not a participant of this event" };
        }

        return {
          event: {
            id: event._id.toString(),
            expert: {
              id: expertId,
              username: event.expert.username,
              email: event.expert.email,
              image: event.expert.image,
              title: event.expert.title,
            },
            customer: {
              id: customerId,
              username: event.customer.username,
              email: event.customer.email,
              image: event.customer.image,
            },
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
          return { error: "Failed to fetch event", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to fetch event", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        eventId: t.String(),
      }),
    }
  );
