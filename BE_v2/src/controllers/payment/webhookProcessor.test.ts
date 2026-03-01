import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Types } from "mongoose";
import { connectToDatabase } from "../../config/database";
import { createTestUser, wipeTestDatabase } from "../../../test/helpers";
import {
  processWebhookPayload,
  type CheckoutCompletedPayload,
  type InvoicePaymentSucceededPayload,
  type PaymentFailedPayload,
  type PaymentSucceededPayload,
  type SubscriptionDeletePayload,
  type SubscriptionUpsertPayload,
  type WebhookEventPayload,
} from "./webhookProcessor";
import { SubscriptionModel, SubscriptionStatus } from "../../models/Subscription";
import { PaymentModel, PaymentStatus, PaymentType } from "../../models/Payment";
import { LogModel } from "../../models/Log";

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  // Warm up Log model indexes — first write is slow on cold starts
  await LogModel.init();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

describe("Webhook Processor — processWebhookPayload", () => {
  // ── checkout_completed ──────────────────────────────────────────────────────

  describe("checkout_completed", () => {
    it("should handle checkout_completed without DB errors", async () => {
      const user = await createTestUser("wh-checkout-1", "wh-checkout-1@test.com");

      const payload: WebhookEventPayload = {
        kind: "checkout_completed",
        data: {
          sessionId: "cs_test_checkout_001",
          userId: user.id,
          mode: "payment",
        } satisfies CheckoutCompletedPayload,
      };

      await expect(processWebhookPayload(payload)).resolves.toBeUndefined();
    });

    it("should handle checkout_completed with empty userId gracefully", async () => {
      const payload: WebhookEventPayload = {
        kind: "checkout_completed",
        data: {
          sessionId: "cs_test_no_user",
          userId: "",
          mode: "subscription",
        } satisfies CheckoutCompletedPayload,
      };

      // Empty userId — must not throw
      await expect(processWebhookPayload(payload)).resolves.toBeUndefined();
    });
  });

  // ── subscription_upsert ────────────────────────────────────────────────────

  describe("subscription_upsert", () => {
    it("should create a new subscription record in DB", async () => {
      const user = await createTestUser("wh-sub-create-1", "wh-sub-create-1@test.com");
      const subId = "sub_test_create_001";
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const payload: WebhookEventPayload = {
        kind: "subscription_upsert",
        data: {
          stripeSubscriptionId: subId,
          userId: user.id,
          planId: "plan_basic",
          normalized: {
            stripeSubscriptionId: subId,
            stripeCustomerId: "cus_test_001",
            stripePriceId: "price_test_001",
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            metadata: {},
          },
        } satisfies SubscriptionUpsertPayload,
      };

      await processWebhookPayload(payload);

      const subscription = await SubscriptionModel.findOne({ stripeSubscriptionId: subId });
      expect(subscription).not.toBeNull();
      expect(subscription?.userId.toString()).toBe(user.id);
      expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription?.planId).toBe("plan_basic");
    });

    it("should update an existing subscription record", async () => {
      const user = await createTestUser("wh-sub-update-1", "wh-sub-update-1@test.com");
      const subId = "sub_test_update_001";
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Create initial subscription via upsert
      const createPayload: WebhookEventPayload = {
        kind: "subscription_upsert",
        data: {
          stripeSubscriptionId: subId,
          userId: user.id,
          planId: "plan_basic",
          normalized: {
            stripeSubscriptionId: subId,
            stripeCustomerId: "cus_test_001",
            stripePriceId: "price_test_001",
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            metadata: {},
          },
        } satisfies SubscriptionUpsertPayload,
      };
      await processWebhookPayload(createPayload);

      // Update to past_due
      const updatePayload: WebhookEventPayload = {
        kind: "subscription_upsert",
        data: {
          stripeSubscriptionId: subId,
          userId: user.id,
          planId: "plan_basic",
          normalized: {
            stripeSubscriptionId: subId,
            stripeCustomerId: "cus_test_001",
            stripePriceId: "price_test_001",
            status: SubscriptionStatus.PAST_DUE,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            metadata: {},
          },
        } satisfies SubscriptionUpsertPayload,
      };
      await processWebhookPayload(updatePayload);

      const subscription = await SubscriptionModel.findOne({ stripeSubscriptionId: subId });
      expect(subscription?.status).toBe(SubscriptionStatus.PAST_DUE);
    });

    it("should skip processing when userId is empty", async () => {
      const subId = "sub_test_no_user_001";
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const payload: WebhookEventPayload = {
        kind: "subscription_upsert",
        data: {
          stripeSubscriptionId: subId,
          userId: "",
          planId: "plan_basic",
          normalized: {
            stripeSubscriptionId: subId,
            stripeCustomerId: "cus_test_001",
            stripePriceId: "price_test_001",
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            metadata: {},
          },
        } satisfies SubscriptionUpsertPayload,
      };

      await processWebhookPayload(payload);

      // No subscription should be created without userId
      const subscription = await SubscriptionModel.findOne({ stripeSubscriptionId: subId });
      expect(subscription).toBeNull();
    });
  });

  // ── subscription_delete ────────────────────────────────────────────────────

  describe("subscription_delete", () => {
    it("should mark an existing subscription as canceled", async () => {
      const user = await createTestUser("wh-sub-del-1", "wh-sub-del-1@test.com");
      const subId = "sub_test_del_001";

      // Seed subscription directly
      await SubscriptionModel.create({
        userId: new Types.ObjectId(user.id),
        stripeSubscriptionId: subId,
        stripeCustomerId: "cus_test_001",
        stripePriceId: "price_test_001",
        planId: "plan_basic",
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        metadata: {},
      });

      const payload: WebhookEventPayload = {
        kind: "subscription_delete",
        data: { stripeSubscriptionId: subId } satisfies SubscriptionDeletePayload,
      };

      await processWebhookPayload(payload);

      const deleted = await SubscriptionModel.findOne({ stripeSubscriptionId: subId });
      expect(deleted?.status).toBe(SubscriptionStatus.CANCELED);
      expect(deleted?.canceledAt).not.toBeNull();
    });

    it("should handle deletion of non-existent subscription gracefully", async () => {
      const payload: WebhookEventPayload = {
        kind: "subscription_delete",
        data: { stripeSubscriptionId: "sub_does_not_exist" } satisfies SubscriptionDeletePayload,
      };

      // Must not throw
      await expect(processWebhookPayload(payload)).resolves.toBeUndefined();
    });
  });

  // ── payment_succeeded ──────────────────────────────────────────────────────

  describe("payment_succeeded", () => {
    it("should create a SUCCEEDED payment record in DB", async () => {
      const user = await createTestUser("wh-pi-succ-1", "wh-pi-succ-1@test.com");
      const piId = "pi_test_succ_001";

      const payload: WebhookEventPayload = {
        kind: "payment_succeeded",
        data: {
          paymentIntentId: piId,
          stripeCustomerId: "cus_test_001",
          userId: user.id,
          amount: 1999,
          currency: "usd",
          description: "Test payment",
          metadata: { userId: user.id },
          subscriptionId: null,
        } satisfies PaymentSucceededPayload,
      };

      await processWebhookPayload(payload);

      const payment = await PaymentModel.findOne({ stripePaymentIntentId: piId });
      expect(payment).not.toBeNull();
      expect(payment?.userId.toString()).toBe(user.id);
      expect(payment?.status).toBe(PaymentStatus.SUCCEEDED);
      expect(payment?.type).toBe(PaymentType.ONE_TIME);
      expect(payment?.amount).toBe(1999);
      expect(payment?.currency).toBe("usd");
    });

    it("should create a SUBSCRIPTION_RECURRING payment when subscriptionId is present", async () => {
      const user = await createTestUser("wh-pi-succ-2", "wh-pi-succ-2@test.com");
      const piId = "pi_test_sub_succ_001";

      const payload: WebhookEventPayload = {
        kind: "payment_succeeded",
        data: {
          paymentIntentId: piId,
          stripeCustomerId: "cus_test_001",
          userId: user.id,
          amount: 999,
          currency: "usd",
          description: "Subscription renewal",
          metadata: { userId: user.id, subscriptionId: "sub_test_001" },
          subscriptionId: "sub_test_001",
        } satisfies PaymentSucceededPayload,
      };

      await processWebhookPayload(payload);

      const payment = await PaymentModel.findOne({ stripePaymentIntentId: piId });
      expect(payment?.type).toBe(PaymentType.SUBSCRIPTION_RECURRING);
    });

    it("should not create payment record when userId is empty", async () => {
      const piId = "pi_test_no_user_001";

      const payload: WebhookEventPayload = {
        kind: "payment_succeeded",
        data: {
          paymentIntentId: piId,
          stripeCustomerId: "cus_test_001",
          userId: "",
          amount: 500,
          currency: "usd",
          description: "No user payment",
          metadata: {},
          subscriptionId: null,
        } satisfies PaymentSucceededPayload,
      };

      await processWebhookPayload(payload);

      const payment = await PaymentModel.findOne({ stripePaymentIntentId: piId });
      expect(payment).toBeNull();
    });
  });

  // ── payment_failed ─────────────────────────────────────────────────────────

  describe("payment_failed", () => {
    it("should create a FAILED payment record in DB", async () => {
      const user = await createTestUser("wh-pi-fail-1", "wh-pi-fail-1@test.com");
      const piId = "pi_test_fail_001";

      const payload: WebhookEventPayload = {
        kind: "payment_failed",
        data: {
          paymentIntentId: piId,
          stripeCustomerId: "cus_test_001",
          userId: user.id,
          amount: 999,
          currency: "usd",
          description: "Failed payment",
          metadata: { userId: user.id },
          failureReason: "Insufficient funds",
        } satisfies PaymentFailedPayload,
      };

      await processWebhookPayload(payload);

      const payment = await PaymentModel.findOne({ stripePaymentIntentId: piId });
      expect(payment).not.toBeNull();
      expect(payment?.status).toBe(PaymentStatus.FAILED);
      expect(payment?.type).toBe(PaymentType.ONE_TIME);
      expect(payment?.failureReason).toBe("Insufficient funds");
    });

    it("should create FAILED record with null failureReason", async () => {
      const user = await createTestUser("wh-pi-fail-2", "wh-pi-fail-2@test.com");
      const piId = "pi_test_fail_noreason_001";

      const payload: WebhookEventPayload = {
        kind: "payment_failed",
        data: {
          paymentIntentId: piId,
          stripeCustomerId: "cus_test_001",
          userId: user.id,
          amount: 500,
          currency: "usd",
          description: "",
          metadata: {},
          failureReason: null,
        } satisfies PaymentFailedPayload,
      };

      await processWebhookPayload(payload);

      const payment = await PaymentModel.findOne({ stripePaymentIntentId: piId });
      expect(payment?.status).toBe(PaymentStatus.FAILED);
    });
  });

  // ── invoice_payment_succeeded ──────────────────────────────────────────────

  describe("invoice_payment_succeeded", () => {
    it("should create a SUBSCRIPTION_RECURRING payment from invoice", async () => {
      const user = await createTestUser("wh-inv-1", "wh-inv-1@test.com");
      const piId = "pi_test_inv_001";

      const payload: WebhookEventPayload = {
        kind: "invoice_payment_succeeded",
        data: {
          paymentIntentId: piId,
          stripeCustomerId: "cus_test_001",
          subscriptionId: "sub_inv_001",
          userId: user.id,
          amountPaid: 1999,
          currency: "usd",
          invoiceNumber: "INV-001",
          metadata: { userId: user.id },
        } satisfies InvoicePaymentSucceededPayload,
      };

      await processWebhookPayload(payload);

      const payment = await PaymentModel.findOne({ stripePaymentIntentId: piId });
      expect(payment).not.toBeNull();
      expect(payment?.type).toBe(PaymentType.SUBSCRIPTION_RECURRING);
      expect(payment?.status).toBe(PaymentStatus.SUCCEEDED);
      expect(payment?.amount).toBe(1999);
      expect(payment?.description).toContain("INV-001");
    });
  });

  // ── unhandled ──────────────────────────────────────────────────────────────

  describe("unhandled", () => {
    it("should handle unknown event types without throwing", async () => {
      const payload: WebhookEventPayload = {
        kind: "unhandled",
        originalType: "some.unknown.event.type",
      };

      await expect(processWebhookPayload(payload)).resolves.toBeUndefined();
    });

    it("should handle various unknown event types", async () => {
      const unknownEvents: WebhookEventPayload[] = [
        { kind: "unhandled", originalType: "customer.created" },
        { kind: "unhandled", originalType: "charge.succeeded" },
        { kind: "unhandled", originalType: "invoice.upcoming" },
      ];

      for (const event of unknownEvents) {
        await expect(processWebhookPayload(event)).resolves.toBeUndefined();
      }
    });
  });
});
