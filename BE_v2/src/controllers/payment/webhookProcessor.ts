import Stripe from "stripe";
import { SubscriptionModel, SubscriptionStatus } from "../../models/Subscription";
import { PaymentModel, PaymentStatus, PaymentType } from "../../models/Payment";
import { UserModel } from "../../models/User";
import { normalizeStripeSubscription } from "./shared";
import { logInfo } from "../../middlewares/logger";

type StripeInvoiceWithPaymentFields = Stripe.Invoice & {
  subscription: string | Stripe.Subscription | null;
  payment_intent: string | Stripe.PaymentIntent | null;
  amount_paid: number;
};

// Event processor - discriminated union pattern (Law 4)
export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case "payment_intent.succeeded":
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;

    case "payment_intent.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;

    default:
      // Log but don't fail for unknown events
      await logInfo(`Unhandled webhook event: ${event.type}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) return;

  await logInfo("Checkout completed", {
    userId,
    sessionId: session.id,
    mode: session.mode,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata.userId;
  if (!userId) return;

  // Normalize external data (pure function - Law 2 & 3)
  const normalized = normalizeStripeSubscription(subscription);

  // Find or create subscription record
  const existing = await SubscriptionModel.findOne({
    stripeSubscriptionId: subscription.id,
  });

  if (existing) {
    // Update existing
    Object.assign(existing, normalized);
    await existing.save();
  } else {
    // Create new
    const newSub = await SubscriptionModel.create({
      userId,
      ...normalized,
      planId: subscription.metadata.planId || "unknown",
    });

    // Update user's subscription reference
    await UserModel.updateOne(
      { _id: userId },
      {
        subscription: {
          subscriptionId: newSub._id,
          planId: subscription.metadata.planId || "unknown",
          status: normalized.status,
        },
      }
    );
  }

  await logInfo("Subscription updated", {
    userId,
    subscriptionId: subscription.id,
    status: normalized.status,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  await SubscriptionModel.updateOne(
    { stripeSubscriptionId: subscription.id },
    {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
    }
  );

  // Clear user's subscription reference
  const subscriptionDoc = await SubscriptionModel.findOne({
    stripeSubscriptionId: subscription.id,
  });

  if (subscriptionDoc) {
    await UserModel.updateOne(
      { "subscription.subscriptionId": subscriptionDoc._id },
      { $unset: { subscription: 1 } }
    );
  }

  await logInfo("Subscription deleted", {
    subscriptionId: subscription.id,
  });
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const userId = paymentIntent.metadata.userId;
  if (!userId) return;

  // Create payment record
  await PaymentModel.create({
    userId,
    stripePaymentIntentId: paymentIntent.id,
    stripeCustomerId: paymentIntent.customer as string,
    type: paymentIntent.metadata.subscriptionId
      ? PaymentType.SUBSCRIPTION_RECURRING
      : PaymentType.ONE_TIME,
    status: PaymentStatus.SUCCEEDED,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    description: paymentIntent.description || "",
    metadata: paymentIntent.metadata as Record<string, string>,
  });

  await logInfo("Payment succeeded", {
    userId: paymentIntent.metadata.userId,
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
  });
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const userId = paymentIntent.metadata.userId;
  if (!userId) return;

  await PaymentModel.create({
    userId,
    stripePaymentIntentId: paymentIntent.id,
    stripeCustomerId: paymentIntent.customer as string,
    type: PaymentType.ONE_TIME,
    status: PaymentStatus.FAILED,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    description: paymentIntent.description || "",
    metadata: paymentIntent.metadata as Record<string, string>,
    failureReason: paymentIntent.last_payment_error?.message,
  });

  await logInfo("Payment failed", {
    userId: paymentIntent.metadata.userId,
    paymentIntentId: paymentIntent.id,
    reason: paymentIntent.last_payment_error?.message,
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const typedInvoice = invoice as StripeInvoiceWithPaymentFields;

  // Record subscription payment
  const subscription = typedInvoice.subscription;
  if (subscription) {
    const userId = invoice.metadata?.userId;
    if (!userId) return;

    const paymentIntent = typedInvoice.payment_intent;
    const stripePaymentIntentId =
      typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
    if (!stripePaymentIntentId) return;

    await PaymentModel.create({
      userId,
      stripePaymentIntentId,
      stripeCustomerId: invoice.customer as string,
      type: PaymentType.SUBSCRIPTION_RECURRING,
      status: PaymentStatus.SUCCEEDED,
      amount: typedInvoice.amount_paid,
      currency: invoice.currency,
      description: `Invoice ${invoice.number}`,
      metadata: (invoice.metadata as Record<string, string>) || {},
    });
  }
}
