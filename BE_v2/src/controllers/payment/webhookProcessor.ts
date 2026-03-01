import Stripe from "stripe";
import { SubscriptionModel, SubscriptionStatus } from "../../models/Subscription";
import { PaymentModel, PaymentStatus, PaymentType } from "../../models/Payment";
import { UserModel } from "../../models/User";
import { normalizeStripeSubscription, NormalizedSubscription } from "./shared";
import { logInfo } from "../../middlewares/logger";

// ── Internal normalized event payload types (Law 2 — single ingress normalizer) ──

/** Normalized payload for checkout.session.completed */
export interface CheckoutCompletedPayload {
  sessionId: string;
  userId: string;
  mode: string;
}

/** Normalized payload for subscription created/updated events */
export interface SubscriptionUpsertPayload {
  stripeSubscriptionId: string;
  userId: string;
  planId: string;
  normalized: NormalizedSubscription;
}

/** Normalized payload for subscription deleted events */
export interface SubscriptionDeletePayload {
  stripeSubscriptionId: string;
}

/** Normalized payload for payment_intent.succeeded */
export interface PaymentSucceededPayload {
  paymentIntentId: string;
  stripeCustomerId: string;
  userId: string;
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  subscriptionId: string | null;
}

/** Normalized payload for payment_intent.payment_failed */
export interface PaymentFailedPayload {
  paymentIntentId: string;
  stripeCustomerId: string;
  userId: string;
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  failureReason: string | null;
}

/** Normalized payload for invoice.payment_succeeded */
export interface InvoicePaymentSucceededPayload {
  paymentIntentId: string;
  stripeCustomerId: string;
  subscriptionId: string;
  userId: string;
  amountPaid: number;
  currency: string;
  invoiceNumber: string;
  metadata: Record<string, string>;
}

/** Discriminated union of all normalized webhook payloads (Law 4 — totality) */
export type WebhookEventPayload =
  | { kind: "checkout_completed"; data: CheckoutCompletedPayload }
  | { kind: "subscription_upsert"; data: SubscriptionUpsertPayload }
  | { kind: "subscription_delete"; data: SubscriptionDeletePayload }
  | { kind: "payment_succeeded"; data: PaymentSucceededPayload }
  | { kind: "payment_failed"; data: PaymentFailedPayload }
  | { kind: "invoice_payment_succeeded"; data: InvoicePaymentSucceededPayload }
  | { kind: "unhandled"; originalType: string };

// ── Type helpers for raw Stripe objects ──────────────────────────────────────

type StripeInvoiceWithPaymentFields = Stripe.Invoice & {
  subscription: string | Stripe.Subscription | null;
  payment_intent: string | Stripe.PaymentIntent | null;
  amount_paid: number;
};

// ── Boundary normalizer (pure function — Law 3) ───────────────────────────────

/**
 * Normalizes a raw Stripe.Event into a typed internal WebhookEventPayload.
 * This is the single ingress boundary (Law 2) for webhook events.
 * Returns `{ kind: "unhandled" }` for unknown event types instead of throwing.
 */
export function normalizeStripeEvent(event: Stripe.Event): WebhookEventPayload {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? "";
      return {
        kind: "checkout_completed",
        data: { sessionId: session.id, userId, mode: session.mode },
      };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId ?? "";
      const planId = subscription.metadata.planId ?? "unknown";
      const normalized = normalizeStripeSubscription(subscription);
      return {
        kind: "subscription_upsert",
        data: { stripeSubscriptionId: subscription.id, userId, planId, normalized },
      };
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      return {
        kind: "subscription_delete",
        data: { stripeSubscriptionId: subscription.id },
      };
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const userId = pi.metadata.userId ?? "";
      return {
        kind: "payment_succeeded",
        data: {
          paymentIntentId: pi.id,
          stripeCustomerId: pi.customer as string,
          userId,
          amount: pi.amount,
          currency: pi.currency,
          description: pi.description ?? "",
          metadata: pi.metadata as Record<string, string>,
          subscriptionId: pi.metadata.subscriptionId ?? null,
        },
      };
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const userId = pi.metadata.userId ?? "";
      return {
        kind: "payment_failed",
        data: {
          paymentIntentId: pi.id,
          stripeCustomerId: pi.customer as string,
          userId,
          amount: pi.amount,
          currency: pi.currency,
          description: pi.description ?? "",
          metadata: pi.metadata as Record<string, string>,
          failureReason: pi.last_payment_error?.message ?? null,
        },
      };
    }

    case "invoice.payment_succeeded": {
      const typedInvoice = event.data.object as StripeInvoiceWithPaymentFields;
      const subscriptionField = typedInvoice.subscription;
      if (!subscriptionField) {
        return { kind: "unhandled", originalType: event.type };
      }
      const userId = typedInvoice.metadata?.userId ?? "";
      if (!userId) {
        return { kind: "unhandled", originalType: event.type };
      }
      const paymentIntentField = typedInvoice.payment_intent;
      const paymentIntentId =
        typeof paymentIntentField === "string"
          ? paymentIntentField
          : (paymentIntentField?.id ?? "");
      if (!paymentIntentId) {
        return { kind: "unhandled", originalType: event.type };
      }
      const subscriptionId =
        typeof subscriptionField === "string" ? subscriptionField : subscriptionField.id;
      return {
        kind: "invoice_payment_succeeded",
        data: {
          paymentIntentId,
          stripeCustomerId: typedInvoice.customer as string,
          subscriptionId,
          userId,
          amountPaid: typedInvoice.amount_paid,
          currency: typedInvoice.currency,
          invoiceNumber: typedInvoice.number ?? "",
          metadata: (typedInvoice.metadata as Record<string, string>) ?? {},
        },
      };
    }

    default:
      return { kind: "unhandled", originalType: event.type };
  }
}

// ── Core processor (effect handler — Law 3) ───────────────────────────────────

/**
 * Processes a normalized WebhookEventPayload, applying DB side effects.
 * This is the testable core — accepts internal types, no Stripe SDK dependency.
 */
export async function processWebhookPayload(payload: WebhookEventPayload): Promise<void> {
  switch (payload.kind) {
    case "checkout_completed":
      await handleCheckoutCompleted(payload.data);
      break;

    case "subscription_upsert":
      await handleSubscriptionUpsert(payload.data);
      break;

    case "subscription_delete":
      await handleSubscriptionDelete(payload.data);
      break;

    case "payment_succeeded":
      await handlePaymentSucceeded(payload.data);
      break;

    case "payment_failed":
      await handlePaymentFailed(payload.data);
      break;

    case "invoice_payment_succeeded":
      await handleInvoicePaymentSucceeded(payload.data);
      break;

    case "unhandled":
      // Logging is a fire-and-forget side effect — must not block the handler.
      void logInfo(`Unhandled webhook event: ${payload.originalType}`);
      break;
  }
}

// ── Public entry point: Stripe.Event → normalize → process ───────────────────

/**
 * Top-level entry: normalizes a raw Stripe.Event and dispatches to processWebhookPayload.
 * Called by the webhook controller after signature verification.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  const payload = normalizeStripeEvent(event);
  return processWebhookPayload(payload);
}

// ── Individual effect handlers ────────────────────────────────────────────────

async function handleCheckoutCompleted(data: CheckoutCompletedPayload): Promise<void> {
  if (!data.userId) return;

  // Logging is a fire-and-forget observability side effect (Law 3: effects must
  // not block the pure core). Awaiting logInfo() ties processWebhookPayload's
  // resolution to LogModel.create() — a DB write that is unrelated to the
  // business outcome.  When the Mongoose connection is under load the write can
  // buffer for up to bufferTimeoutMS (default 10 s), which races against the
  // test/request timeout.  Using void makes the intent explicit and removes the
  // blocking.  createLog() already has an internal try/catch so failures are
  // never propagated.
  void logInfo("Checkout completed", {
    userId: data.userId,
    sessionId: data.sessionId,
    mode: data.mode,
  });
}

async function handleSubscriptionUpsert(data: SubscriptionUpsertPayload): Promise<void> {
  if (!data.userId) return;

  const existing = await SubscriptionModel.findOne({
    stripeSubscriptionId: data.stripeSubscriptionId,
  });

  if (existing) {
    Object.assign(existing, data.normalized);
    await existing.save();
  } else {
    const newSub = await SubscriptionModel.create({
      userId: data.userId,
      ...data.normalized,
      planId: data.planId,
    });

    await UserModel.updateOne(
      { _id: data.userId },
      {
        subscription: {
          subscriptionId: newSub._id,
          planId: data.planId,
          status: data.normalized.status,
        },
      }
    );
  }

  void logInfo("Subscription upserted", {
    userId: data.userId,
    subscriptionId: data.stripeSubscriptionId,
    status: data.normalized.status,
  });
}

async function handleSubscriptionDelete(data: SubscriptionDeletePayload): Promise<void> {
  await SubscriptionModel.updateOne(
    { stripeSubscriptionId: data.stripeSubscriptionId },
    { status: SubscriptionStatus.CANCELED, canceledAt: new Date() }
  );

  const subscriptionDoc = await SubscriptionModel.findOne({
    stripeSubscriptionId: data.stripeSubscriptionId,
  });

  if (subscriptionDoc) {
    await UserModel.updateOne(
      { "subscription.subscriptionId": subscriptionDoc._id },
      { $unset: { subscription: 1 } }
    );
  }

  void logInfo("Subscription deleted", { subscriptionId: data.stripeSubscriptionId });
}

async function handlePaymentSucceeded(data: PaymentSucceededPayload): Promise<void> {
  if (!data.userId) return;

  await PaymentModel.create({
    userId: data.userId,
    stripePaymentIntentId: data.paymentIntentId,
    stripeCustomerId: data.stripeCustomerId,
    type: data.subscriptionId ? PaymentType.SUBSCRIPTION_RECURRING : PaymentType.ONE_TIME,
    status: PaymentStatus.SUCCEEDED,
    amount: data.amount,
    currency: data.currency,
    description: data.description,
    metadata: data.metadata,
  });

  void logInfo("Payment succeeded", {
    userId: data.userId,
    paymentIntentId: data.paymentIntentId,
    amount: data.amount,
  });
}

async function handlePaymentFailed(data: PaymentFailedPayload): Promise<void> {
  if (!data.userId) return;

  await PaymentModel.create({
    userId: data.userId,
    stripePaymentIntentId: data.paymentIntentId,
    stripeCustomerId: data.stripeCustomerId,
    type: PaymentType.ONE_TIME,
    status: PaymentStatus.FAILED,
    amount: data.amount,
    currency: data.currency,
    description: data.description,
    metadata: data.metadata,
    failureReason: data.failureReason ?? undefined,
  });

  void logInfo("Payment failed", {
    userId: data.userId,
    paymentIntentId: data.paymentIntentId,
    reason: data.failureReason,
  });
}

async function handleInvoicePaymentSucceeded(
  data: InvoicePaymentSucceededPayload
): Promise<void> {
  await PaymentModel.create({
    userId: data.userId,
    stripePaymentIntentId: data.paymentIntentId,
    stripeCustomerId: data.stripeCustomerId,
    type: PaymentType.SUBSCRIPTION_RECURRING,
    status: PaymentStatus.SUCCEEDED,
    amount: data.amountPaid,
    currency: data.currency,
    description: `Invoice ${data.invoiceNumber}`,
    metadata: data.metadata,
  });
}
