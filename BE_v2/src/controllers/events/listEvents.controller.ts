import { Context, Elysia, t } from "elysia";
import { FilterQuery, Types } from "mongoose";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { EventModel, IEventDocument, EventStatus } from "../../models/Event";
import { UserRole } from "../../config/roles";

type ListEventsQuery = {
  status?: string;
  role?: string;
  page?: string;
  limit?: string;
};

const VALID_STATUSES: EventStatus[] = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "completed",
];

export const listEventsController = new Elysia()
  .use(requireAuth)
  .get(
    "/",
    async (context) => {
      const { user, set, query } = context as Context & {
        user: AuthUser;
        query: ListEventsQuery;
      };

      try {
        const pageNum = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
        const limitNum = Math.min(
          100,
          Math.max(1, parseInt(query.limit ?? "20", 10) || 20)
        );
        const skip = (pageNum - 1) * limitNum;

        const filter: FilterQuery<IEventDocument> = {};

        if (user.role !== UserRole.ADMIN) {
          const userOid = new Types.ObjectId(user.userId);
          if (query.role === "as-expert") {
            filter["expert"] = userOid;
          } else if (query.role === "as-customer") {
            filter["customer"] = userOid;
          } else {
            filter["$or"] = [{ expert: userOid }, { customer: userOid }];
          }
        }

        if (query.status !== undefined) {
          if (!VALID_STATUSES.includes(query.status as EventStatus)) {
            set.status = 400;
            return { error: "Invalid status value" };
          }
          filter["status"] = query.status as EventStatus;
        }

        const [events, total] = await Promise.all([
          EventModel.find(filter)
            .populate<{
              expert: { _id: Types.ObjectId; username: string };
              customer: { _id: Types.ObjectId; username: string };
            }>([
              { path: "expert", select: "username" },
              { path: "customer", select: "username" },
            ])
            .sort({ start: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean()
            .exec(),
          EventModel.countDocuments(filter).exec(),
        ]);

        return {
          events: events.map((event) => ({
            id: event._id.toString(),
            expert: {
              id: event.expert._id.toString(),
              username: event.expert.username,
            },
            customer: {
              id: event.customer._id.toString(),
              username: event.customer.username,
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
          })),
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
        };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to list events", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to list events", message: "Unknown error" };
      }
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
        role: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  );
