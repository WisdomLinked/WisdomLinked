import { Context, Elysia, t } from "elysia";
import { Types } from "mongoose";
import { requireAuth, AuthUser } from "../../middlewares/auth";
import { EventModel } from "../../models/Event";
import { UserModel } from "../../models/User";

type FeedbackBody = {
  rating: number;
  comment?: string;
};

export const submitFeedbackController = new Elysia()
  .use(requireAuth)
  .post(
    "/",
    async (context) => {
      const { user, set, params, body } = context as Context & {
        user: AuthUser;
        params: { eventId: string };
        body: FeedbackBody;
      };

      try {
        const event = await EventModel.findById(params.eventId).exec();
        if (!event) {
          set.status = 404;
          return { error: "Event not found" };
        }

        if (event.status !== "completed") {
          set.status = 400;
          return {
            error: "Feedback can only be submitted for completed events",
          };
        }

        const customerId = event.customer.toString();
        if (customerId !== user.userId) {
          set.status = 403;
          return {
            error: "Only the customer of this event can submit feedback",
          };
        }

        // Check for duplicate feedback
        const alreadySubmitted = event.feedbacks.some(
          (feedbackUserId) => feedbackUserId.toString() === user.userId
        );
        if (alreadySubmitted) {
          set.status = 409;
          return { error: "Feedback already submitted for this event" };
        }

        if (body.rating < 1 || body.rating > 5) {
          set.status = 400;
          return { error: "Rating must be between 1 and 5" };
        }

        const expertId = event.expert.toString();
        const expert = await UserModel.findById(expertId).exec();
        if (!expert) {
          set.status = 404;
          return { error: "Expert not found" };
        }

        // Push customer userId to event.feedbacks (duplicate tracking)
        event.feedbacks.push(new Types.ObjectId(user.userId));
        await event.save();

        // Push feedback data to expert's feedbacks array
        expert.feedbacks.push({
          rating: body.rating,
          comment: body.comment,
          fromUser: new Types.ObjectId(user.userId),
          event: event._id,
          createdAt: new Date(),
        });

        // Recalculate expert average rating
        const totalRating = expert.feedbacks.reduce(
          (sum, fb) => sum + fb.rating,
          0
        );
        expert.rating =
          expert.feedbacks.length > 0
            ? totalRating / expert.feedbacks.length
            : 0;

        await expert.save();

        return { message: "Feedback submitted" };
      } catch (error) {
        if (error instanceof Error) {
          set.status = 500;
          return {
            error: "Failed to submit feedback",
            message: error.message,
          };
        }
        set.status = 500;
        return { error: "Failed to submit feedback", message: "Unknown error" };
      }
    },
    {
      params: t.Object({
        eventId: t.String(),
      }),
      body: t.Object({
        rating: t.Number({ minimum: 1, maximum: 5 }),
        comment: t.Optional(t.String()),
      }),
    }
  );
