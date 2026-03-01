import { Elysia, t } from "elysia";
import Stripe from "stripe";
import { requireAuth } from "../../middlewares/auth";
import { createStripeClient, getOrCreateStripeCustomer } from "./shared";
import { getSystemSettings } from "../../models/SystemSettings";

export const createCheckoutSessionController = new Elysia()
  .use(requireAuth)
  .post(
    "/",
    async (context) => {
      const body = context.body as { planId: string; successUrl: string; cancelUrl: string };
      const { planId, successUrl, cancelUrl } = body;
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

        const settings = await getSystemSettings();
        const plan = settings.stripePricing.plans.find((p) => p.id === planId);

        if (!plan || !plan.isActive) {
          context.set.status = 404;
          return { error: "Pricing plan not found" };
        }

        const customerId = await getOrCreateStripeCustomer(stripe, user.userId, user.email);

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          customer: customerId,
          mode: plan.type === "subscription" ? "subscription" : "payment",
          payment_method_types: ["card"],
          line_items: [
            {
              price: plan.stripePriceId,
              quantity: 1,
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            userId: user.userId,
            planId: plan.id,
          },
        };

        const session = await stripe.checkout.sessions.create(sessionParams);

        return {
          sessionId: session.id,
          url: session.url,
        };
      } catch (error) {
        // Law 3: Structured error handling at the edge
        if (error instanceof Error) {
          context.set.status = 500;
          return { error: "Failed to create checkout session", message: error.message };
        }
        context.set.status = 500;
        return { error: "Failed to create checkout session", message: "Unknown error" };
      }
    },
    {
      body: t.Object({
        planId: t.String(),
        successUrl: t.String(),
        cancelUrl: t.String(),
      }),
    }
  );
