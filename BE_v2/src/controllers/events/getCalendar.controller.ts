import { Context, Elysia, t } from "elysia";
import { Types } from "mongoose";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { EventModel } from "../../models/Event";

type CalendarQuery = {
  startDate: string;
  endDate: string;
};

export const getCalendarController = new Elysia()
  .use(requireAuth)
  .get(
    "/",
    async (context) => {
      const { user, set, query } = context as Context & {
        user: AuthUser;
        query: CalendarQuery;
      };

      try {
        const startDate = new Date(query.startDate);
        const endDate = new Date(query.endDate);

        if (isNaN(startDate.getTime())) {
          set.status = 400;
          return { error: "Invalid startDate format. Use ISO 8601." };
        }
        if (isNaN(endDate.getTime())) {
          set.status = 400;
          return { error: "Invalid endDate format. Use ISO 8601." };
        }

        const userOid = new Types.ObjectId(user.userId);

        const events = await EventModel.find({
          $or: [{ expert: userOid }, { customer: userOid }],
          status: { $in: ["pending", "accepted", "completed"] },
          start: { $gte: startDate, $lte: endDate },
        })
          .populate<{
            expert: { _id: Types.ObjectId; username: string };
            customer: { _id: Types.ObjectId; username: string };
          }>([
            { path: "expert", select: "username" },
            { path: "customer", select: "username" },
          ])
          .select("_id title start end status expert customer")
          .lean()
          .exec();

        return {
          events: events.map((event) => ({
            id: event._id.toString(),
            title: event.title,
            start: event.start,
            end: event.end,
            status: event.status,
            expert: {
              id: event.expert._id.toString(),
              username: event.expert.username,
            },
            customer: {
              id: event.customer._id.toString(),
              username: event.customer.username,
            },
          })),
        };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to fetch calendar", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to fetch calendar", message: "Unknown error" };
      }
    },
    {
      query: t.Object({
        startDate: t.String(),
        endDate: t.String(),
      }),
    }
  );
