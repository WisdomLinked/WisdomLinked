import { Elysia } from "elysia";
import { requireAuth } from "../../middlewares/auth";
import { SubscriptionModel } from "../../models/Subscription";
import { createStripeClient } from "./shared";

export const cancelSubscriptionController = new Elysia()
  .use(requireAuth)
  .post("/", async (context) => {
    const user = context.user;

    if (!user) {
      context.set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      const stripe = await createStripeClient();
      if (!stripe) {
        context.set.status = 503;
        return { error: "Payment system not configured" };
      }

      const subscription = await SubscriptionModel.findOne({
        userId: user.userId,
        status: { $in: ["active", "trialing", "past_due"] },
      }).sort({ createdAt: -1 });

      if (!subscription) {
        context.set.status = 404;
        return { error: "No active subscription found" };
      }

      // Cancel at period end (don't immediately cancel)
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      subscription.cancelAtPeriodEnd = true;
      await subscription.save();

      return {
        message: "Subscription will be canceled at the end of the billing period",
        subscription: {
          id: subscription._id.toString(),
          cancelAtPeriodEnd: true,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to cancel subscription", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to cancel subscription", message: "Unknown error" };
    }
  });
