import { Elysia } from "elysia";
import { requireAuth } from "../../middlewares/auth";
import { SubscriptionModel } from "../../models/Subscription";

export const getUserSubscriptionController = new Elysia()
  .use(requireAuth)
  .get("/", async (context) => {
    const user = context.user;

    if (!user) {
      context.set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      const subscription = await SubscriptionModel.findOne({
        userId: user.userId,
        status: { $in: ["active", "trialing", "past_due"] },
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!subscription) {
        return { subscription: null };
      }

      return {
        subscription: {
          id: subscription._id.toString(),
          planId: subscription.planId,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to fetch subscription", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to fetch subscription", message: "Unknown error" };
    }
  });
