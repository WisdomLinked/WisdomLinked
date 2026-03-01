import { Context, Elysia, t } from "elysia";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { EventModel } from "../../models/Event";

export const completeEventController = new Elysia()
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

        if (expertId !== user.userId) {
          set.status = 403;
          return { error: "Only the expert can mark an event as completed" };
        }

        if (event.status !== "accepted") {
          set.status = 400;
          return {
            error: `Cannot complete event with status "${event.status}". Only accepted events can be completed.`,
          };
        }

        // Calculate totalTimeSpent in minutes if start and end are both set
        if (event.start !== undefined && event.end !== undefined) {
          const diffMs = event.end.getTime() - event.start.getTime();
          if (diffMs > 0) {
            event.totalTimeSpent = Math.round(diffMs / 60000);
          }
        }

        event.status = "completed";
        await event.save();

        return {
          event: {
            id: event._id.toString(),
            expert: expertId,
            customer: event.customer.toString(),
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
          return { error: "Failed to complete event", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to complete event", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        eventId: t.String(),
      }),
    }
  );
