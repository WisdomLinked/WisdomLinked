import { Elysia, t } from "elysia";
import { Types } from "mongoose";
import { requireAdmin } from "../../middlewares/auth";
import { EventModel } from "../../models/Event";
import { UserModel } from "../../models/User";

type FeedbacksFilter = {
  status: "completed";
  expert?: Types.ObjectId;
};

export const listFeedbacksController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const { page = 1, limit = 20, expertId } = context.query;

      const filter: FeedbacksFilter = { status: "completed" };

      if (expertId !== undefined) {
        if (!Types.ObjectId.isValid(expertId)) {
          context.set.status = 400;
          return { error: "Invalid expertId" };
        }
        filter.expert = new Types.ObjectId(expertId);
      }

      const pageNum = Math.max(1, page);
      const limitNum = Math.min(100, Math.max(1, limit));
      const skip = (pageNum - 1) * limitNum;

      const [events, total] = await Promise.all([
        EventModel.find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate("expert", "username email rating")
          .populate("customer", "username email")
          .lean()
          .exec(),
        EventModel.countDocuments(filter),
      ]);

      const eventIds = events.map((e) => e._id);

      // Gather all unique expert IDs from the result set
      const expertIds = [
        ...new Set(
          events
            .map((e) => (e.expert as { _id: Types.ObjectId } | undefined)?._id?.toString())
            .filter((id): id is string => id !== undefined)
        ),
      ];

      // Fetch experts with their feedbacks for cross-referencing
      const experts = await UserModel.find(
        { _id: { $in: expertIds } },
        { feedbacks: 1 }
      )
        .lean()
        .exec();

      const expertFeedbackMap = new Map(
        experts.map((expert) => [expert._id.toString(), expert.feedbacks])
      );

      const data = events.map((event) => {
        const expertIdStr = (
          event.expert as { _id: Types.ObjectId } | undefined
        )?._id?.toString();

        const allExpertFeedbacks = expertIdStr
          ? (expertFeedbackMap.get(expertIdStr) ?? [])
          : [];

        // Filter to feedbacks that reference this specific event
        const eventFeedbacks = allExpertFeedbacks.filter(
          (fb) => fb.event !== undefined && fb.event.toString() === event._id.toString()
        );

        return {
          id: event._id.toString(),
          title: event.title,
          start: event.start,
          end: event.end,
          status: event.status,
          expert: event.expert,
          customer: event.customer,
          feedbackCount: eventIds.indexOf(event._id) >= 0 ? event.feedbacks.length : 0,
          feedbacks: eventFeedbacks.map((fb) => ({
            rating: fb.rating,
            comment: fb.comment,
            fromUser: fb.fromUser.toString(),
            createdAt: fb.createdAt,
          })),
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        };
      });

      return {
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      context.set.status = 500;
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: "Failed to list feedbacks", message };
    }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      expertId: t.Optional(t.String()),
    }),
  });
