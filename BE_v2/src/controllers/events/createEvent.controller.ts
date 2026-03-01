import { Context, Elysia, t } from "elysia";
import { EventModel } from "../../models/Event";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { UserModel } from "../../models/User";
import { UserRole } from "../../config/roles";
import { sendEventNotification } from "../../services/email";

type CreateEventBody = {
  customerId: string;
  start?: string;
  end?: string;
  duration?: number;
  title?: string;
  price?: number;
};

export const createEventController = new Elysia()
  .use(requireAuth)
  .post(
    "/",
    async (context) => {
      const { user, set, body } = context as Context & {
        user: AuthUser;
        body: CreateEventBody;
      };

      try {
        if (user.role !== UserRole.EXPERT) {
          set.status = 403;
          return { error: "Only experts can create events" };
        }

        const customer = await UserModel.findById(body.customerId).lean().exec();
        if (!customer) {
          set.status = 404;
          return { error: "Customer not found" };
        }
        if (customer.role !== UserRole.CUSTOMER) {
          set.status = 400;
          return { error: "Specified user is not a customer" };
        }

        const startDate = body.start ? new Date(body.start) : undefined;
        const endDate = body.end ? new Date(body.end) : undefined;

        if (startDate !== undefined && isNaN(startDate.getTime())) {
          set.status = 400;
          return { error: "Invalid start date format" };
        }
        if (endDate !== undefined && isNaN(endDate.getTime())) {
          set.status = 400;
          return { error: "Invalid end date format" };
        }

        const event = await EventModel.create({
          expert: user.userId,
          customer: body.customerId,
          start: startDate,
          end: endDate,
          duration: body.duration,
          title: body.title,
          price: body.price,
          status: "pending",
          createdBy: user.userId,
        });

        await UserModel.findByIdAndUpdate(user.userId, {
          $push: { events: event._id },
        });
        await UserModel.findByIdAndUpdate(body.customerId, {
          $push: { events: event._id },
        });

        await sendEventNotification(customer.email, {
          title: event.title ?? "New Event",
          date: event.start ? event.start.toISOString() : "TBD",
          expertName: user.username,
          status: "pending",
        });

        return {
          event: {
            id: event._id.toString(),
            expert: user.userId,
            customer: body.customerId,
            start: event.start,
            end: event.end,
            duration: event.duration,
            title: event.title,
            status: event.status,
            price: event.price,
            createdBy: event.createdBy.toString(),
            totalTimeSpent: event.totalTimeSpent,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return { error: "Failed to create event", message: error.message };
        }
        set.status = 500;
        return { error: "Failed to create event", message: "Unknown error" };
      }
    },
    {
      body: t.Object({
        customerId: t.String(),
        start: t.Optional(t.String()),
        end: t.Optional(t.String()),
        duration: t.Optional(t.Number()),
        title: t.Optional(t.String()),
        price: t.Optional(t.Number()),
      }),
    }
  );
