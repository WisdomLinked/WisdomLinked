import Stripe from "stripe";
import { getSystemSettings } from "../../models/SystemSettings";
import { StripeEventModel, StripeEventStatus } from "../../models/StripeEvent";
import { SubscriptionStatus } from "../../models/Subscription";
import { UserModel } from "../../models/User";

type StripeSubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start: number;
  current_period_end: number;
};

export interface NormalizedSubscription {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  metadata: Record<string, string>;
}

// Pure function: Map Stripe status to our enum (Law 3 & 4)
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    active: SubscriptionStatus.ACTIVE,
    canceled: SubscriptionStatus.CANCELED,
    past_due: SubscriptionStatus.PAST_DUE,
    unpaid: SubscriptionStatus.UNPAID,
    trialing: SubscriptionStatus.TRIALING,
    incomplete: SubscriptionStatus.INCOMPLETE,
    incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
    paused: SubscriptionStatus.PAUSED,
  };
  return statusMap[status];
}

// Pure function: Normalize Stripe subscription data (Law 2 & 3)
export function normalizeStripeSubscription(
  stripeSubscription: Stripe.Subscription
): NormalizedSubscription {
  const typedSubscription = stripeSubscription as StripeSubscriptionWithPeriods;
  const priceId = stripeSubscription.items.data[0]?.price.id;
  if (!priceId) {
    throw new Error("Subscription missing price ID");
  }

  const currentPeriodStart = typedSubscription.current_period_start;
  const currentPeriodEnd = typedSubscription.current_period_end;

  return {
    stripeSubscriptionId: stripeSubscription.id,
    stripeCustomerId: stripeSubscription.customer as string,
    stripePriceId: priceId,
    status: mapStripeStatus(stripeSubscription.status),
    currentPeriodStart: new Date(currentPeriodStart * 1000),
    currentPeriodEnd: new Date(currentPeriodEnd * 1000),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    canceledAt: stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000)
      : undefined,
    metadata: stripeSubscription.metadata as Record<string, string>,
  };
}

// Effect handler: Create Stripe client (Law 3 - explicit effect)
export async function createStripeClient(): Promise<Stripe | null> {
  const settings = await getSystemSettings();

  if (!settings.stripeConfig?.enabled || !settings.stripeConfig?.secretKey) {
    return null;
  }

  return new Stripe(settings.stripeConfig.secretKey, {
    apiVersion: "2026-02-25.clover",
  });
}

// Pure validation function (Law 3)
export function validateWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string,
  stripe: Stripe
): Stripe.Event | { error: string } {
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return event;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid signature" };
  }
}

// Check for duplicate webhook event (idempotency - Law 5)
export async function isEventProcessed(eventId: string): Promise<boolean> {
  const existing = await StripeEventModel.findOne({
    stripeEventId: eventId,
    status: StripeEventStatus.PROCESSED,
  });
  return existing !== null;
}

// Create or get Stripe customer (effect handler - Law 3)
export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  userId: string,
  email: string
): Promise<string> {
  const user = await UserModel.findById(userId);

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await UserModel.updateOne({ _id: userId }, { stripeCustomerId: customer.id });

  return customer.id;
}
