import { Elysia, t } from "elysia";
import { requireAuth } from "../../middlewares/auth";
import { EventModel } from "../../models/Event";
import { createPaymentIntent } from "../../services/payment";

export const createEventPaymentController = new Elysia()
  .use(requireAuth)
  .post(
    "/",
    async (context) => {
      const body = context.body as { eventId: string; amount: number; currency: string };
      const { eventId, amount, currency } = body;
      const user = context.user;

      if (!user) {
        context.set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        // Validate event exists
        const event = await EventModel.findById(eventId).lean();
        if (!event) {
          context.set.status = 404;
          return { error: "Event not found" };
        }

        // Validate event is bookable (must be in pending state)
        if (event.status !== "pending") {
          context.set.status = 400;
          return { error: "Event is not available for booking" };
        }

        // Create payment intent via Stripe service
        const paymentIntent = await createPaymentIntent(amount, currency, {
          userId: user.userId,
          eventId,
        });

        return {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        };
      } catch (error) {
        if (error instanceof Error) {
          context.set.status = 500;
          return { error: "Failed to create event payment", message: error.message };
        }
        context.set.status = 500;
        return { error: "Failed to create event payment", message: "Unknown error" };
      }
    },
    {
      body: t.Object({
        eventId: t.String(),
        amount: t.Number(),
        currency: t.String(),
      }),
    }
  );
