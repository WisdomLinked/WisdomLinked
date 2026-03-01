import { Elysia } from "elysia";
import Stripe from "stripe";
import { getSystemSettings } from "../../models/SystemSettings";
import { StripeEventModel, StripeEventStatus } from "../../models/StripeEvent";
import { processStripeEvent } from "./webhookProcessor";
import { createStripeClient } from "./shared";

export const handleStripeWebhookController = new Elysia().post("/", async (context) => {
  try {
    const signature = context.request.headers.get("stripe-signature");

    if (!signature) {
      context.set.status = 400;
      return { error: "Missing stripe-signature header" };
    }

    const settings = await getSystemSettings();
    if (!settings.stripeConfig?.webhookSecret) {
      context.set.status = 503;
      return { error: "Webhook secret not configured" };
    }

    const stripe = await createStripeClient();
    if (!stripe) {
      context.set.status = 503;
      return { error: "Stripe not configured" };
    }

    // Get raw body for signature verification
    const rawBody = await context.request.text();

    // Validate webhook signature (pure function - Law 3)
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        settings.stripeConfig.webhookSecret
      );
    } catch (_err) {
      context.set.status = 400;
      return { error: "Invalid webhook signature" };
    }

    // Check idempotency (Law 5 - prevent duplicate processing)
    const existing = await StripeEventModel.findOne({
      stripeEventId: event.id,
    });

    if (existing && existing.status === StripeEventStatus.PROCESSED) {
      return { received: true, status: "already_processed" };
    }

    // Store event (even before processing for replay - Law 5)
    if (!existing) {
      await StripeEventModel.create({
        stripeEventId: event.id,
        type: event.type,
        payload: event.data.object,
        status: StripeEventStatus.PENDING,
        retryCount: 0,
      });
    }

    // Process event (effect handler - Law 3)
    try {
      await processStripeEvent(event);

      // Mark as processed
      await StripeEventModel.updateOne(
        { stripeEventId: event.id },
        {
          status: StripeEventStatus.PROCESSED,
          processedAt: new Date(),
        }
      );

      return { received: true };
    } catch (error) {
      // Mark as failed for retry
      await StripeEventModel.updateOne(
        { stripeEventId: event.id },
        {
          status: StripeEventStatus.FAILED,
          failureReason: error instanceof Error ? error.message : "Unknown error",
          $inc: { retryCount: 1 },
        }
      );

      throw error;
    }
  } catch (error) {
    // Log but don't fail - Stripe will retry
    console.error("Webhook processing error:", error);
    context.set.status = 500;
    return { error: "Webhook processing failed" };
  }
});
