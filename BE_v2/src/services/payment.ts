/**
 * Payment Service — Stripe integration for WisdomLinked payments.
 *
 * The Stripe client is initialised lazily on first use from the typed env
 * config (Law 2 — single ingress, Law 3 — explicit effect handler).
 *
 * Config is read lazily on first use rather than at module-load time so that
 * the module can be imported before the test-runner preload has run.
 *
 * All exported functions are standalone (not a class) and return typed Stripe
 * objects so callers depend only on well-typed internal representations, never
 * on raw Stripe response shapes.
 *
 * Env vars consumed (via getBackendEnvironmentConfig — both optional):
 *   STRIPE_SECRET_KEY      — absent → Stripe disabled, functions throw on call
 *   STRIPE_WEBHOOK_SECRET  — absent → Stripe disabled, functions throw on call
 */

import Stripe from "stripe";
import { getBackendEnvironmentConfig } from "../config/env";

// ── Bootstrap ──────────────────────────────────────────────────────────────

// Bundle both Stripe credentials so the null check is a single guard that
// also narrows webhookSecret to string in the non-null branch.
interface StripeBundle {
  client: Stripe;
  webhookSecret: string;
}

// Lazy-initialised Stripe state: undefined = not yet resolved,
// null = resolved to disabled, StripeBundle = resolved to enabled.
let _stripeBundleState: StripeBundle | null | undefined = undefined;

function _buildStripeBundle(): StripeBundle | null {
  const { stripeSecretKey, stripeWebhookSecret } = getBackendEnvironmentConfig();
  if (stripeSecretKey === undefined || stripeWebhookSecret === undefined) {
    return null;
  }
  return {
    client: new Stripe(stripeSecretKey, { apiVersion: "2026-02-25.clover" }),
    webhookSecret: stripeWebhookSecret,
  };
}

function _requireStripe(): StripeBundle {
  if (_stripeBundleState === undefined) {
    _stripeBundleState = _buildStripeBundle();
    if (_stripeBundleState === null) {
      console.log("[payment] Stripe not configured — payment endpoints will return 503");
    }
  }
  if (_stripeBundleState === null) {
    throw new Error(
      "Stripe is not configured. " +
        "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET environment variables."
    );
  }
  return _stripeBundleState;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a PaymentIntent for a one-off charge.
 *
 * @param amount   Amount in the smallest currency unit (e.g. cents for USD).
 * @param currency ISO 4217 currency code (e.g. "usd").
 * @param metadata Arbitrary string key→value pairs attached to the intent.
 */
export async function createPaymentIntent(
  amount: number,
  currency: string,
  metadata: Record<string, string>
): Promise<Stripe.PaymentIntent> {
  const { client } = _requireStripe();
  return client.paymentIntents.create({
    amount,
    currency,
    metadata,
    automatic_payment_methods: { enabled: true },
  });
}

/**
 * Confirm and capture a PaymentIntent.
 *
 * @param paymentIntentId The `pi_…` identifier.
 */
export async function confirmPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const { client } = _requireStripe();
  return client.paymentIntents.confirm(paymentIntentId);
}

/**
 * Refund a payment, either fully or partially.
 *
 * @param paymentIntentId The `pi_…` identifier to refund.
 * @param amount          Optional partial refund amount in smallest currency
 *                        unit.  Omit for a full refund.
 */
export async function refundPayment(
  paymentIntentId: string,
  amount?: number
): Promise<Stripe.Refund> {
  const { client } = _requireStripe();
  const params: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId,
    ...(amount !== undefined ? { amount } : {}),
  };
  return client.refunds.create(params);
}

/**
 * Verify a Stripe webhook signature and return the parsed Event.
 *
 * This is a synchronous operation — Stripe's signature verification does not
 * perform I/O.  Throws a `Stripe.errors.StripeSignatureVerificationError` if
 * the signature is invalid; callers must handle that at the boundary.
 *
 * @param body      Raw request body as a string (before JSON parsing).
 * @param signature Value of the `Stripe-Signature` header.
 */
export function constructWebhookEvent(body: string, signature: string): Stripe.Event {
  const { client, webhookSecret } = _requireStripe();
  return client.webhooks.constructEvent(body, signature, webhookSecret);
}

/**
 * Retrieve a PaymentIntent by ID.
 *
 * @param paymentIntentId The `pi_…` identifier.
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  const { client } = _requireStripe();
  return client.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Create a Stripe Customer record.
 *
 * @param email Customer email address.
 * @param name  Customer display name.
 */
export async function createCustomer(email: string, name: string): Promise<Stripe.Customer> {
  const { client } = _requireStripe();
  return client.customers.create({ email, name });
}

/**
 * List PaymentIntents associated with a Stripe Customer.
 *
 * @param customerId Stripe customer ID (`cus_…`).
 * @param limit      Number of records to return (default 10, max 100).
 */
export async function listPaymentsByCustomer(
  customerId: string,
  limit: number = 10
): Promise<Stripe.PaymentIntent[]> {
  const { client } = _requireStripe();
  const response = await client.paymentIntents.list({
    customer: customerId,
    limit,
  });
  return response.data;
}
