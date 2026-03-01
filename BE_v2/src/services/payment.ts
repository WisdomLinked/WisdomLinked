/**
 * Payment Service — Stripe integration for WisdomLinked payments.
 *
 * The Stripe client is initialised once at module load from the typed env
 * config (Law 2 — single ingress, Law 3 — explicit effect handler).
 *
 * All exported functions are standalone (not a class) and return typed Stripe
 * objects so callers depend only on well-typed internal representations, never
 * on raw Stripe response shapes.
 *
 * Env vars consumed (via getBackendEnvironmentConfig):
 *   STRIPE_SECRET_KEY      — required
 *   STRIPE_WEBHOOK_SECRET  — required
 */

import Stripe from "stripe";
import { getBackendEnvironmentConfig } from "../config/env";

// ── Bootstrap ──────────────────────────────────────────────────────────────

const _env = getBackendEnvironmentConfig();

const _stripe = new Stripe(_env.stripeSecretKey, {
  apiVersion: "2026-02-25.clover",
});

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
  return _stripe.paymentIntents.create({
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
  return _stripe.paymentIntents.confirm(paymentIntentId);
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
  const params: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId,
    ...(amount !== undefined ? { amount } : {}),
  };
  return _stripe.refunds.create(params);
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
  return _stripe.webhooks.constructEvent(body, signature, _env.stripeWebhookSecret);
}

/**
 * Retrieve a PaymentIntent by ID.
 *
 * @param paymentIntentId The `pi_…` identifier.
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return _stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Create a Stripe Customer record.
 *
 * @param email Customer email address.
 * @param name  Customer display name.
 */
export async function createCustomer(email: string, name: string): Promise<Stripe.Customer> {
  return _stripe.customers.create({ email, name });
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
  const response = await _stripe.paymentIntents.list({
    customer: customerId,
    limit,
  });
  return response.data;
}
