import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { Types } from "mongoose";
import { connectToDatabase } from "../../config/database";
import { createTestUser, wipeTestDatabase, authHeader } from "../../../test/helpers";
import { paymentRoutes } from "../../routes/v1/payment";
import { SubscriptionModel, SubscriptionStatus } from "../../models/Subscription";
import { updateSystemSettings } from "../../models/SystemSettings";

function buildPaymentApp() {
  return new Elysia().use(paymentRoutes);
}

type PaymentApp = ReturnType<typeof buildPaymentApp>;

let app: PaymentApp;

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  app = buildPaymentApp();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

describe("Cancel Subscription Controller", () => {
  describe("POST /api/v1/payment/subscription/cancel", () => {
    it("should reject request without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/subscription/cancel", {
          method: "POST",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should return 503 when Stripe is not configured", async () => {
      const user = await createTestUser("cancel-sub-user1", "cancel-sub-user1@test.com");

      await updateSystemSettings({
        stripeConfig: { enabled: false },
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/subscription/cancel", {
          method: "POST",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should return 404 when user has no active subscription", async () => {
      const user = await createTestUser("cancel-sub-user2", "cancel-sub-user2@test.com");

      await updateSystemSettings({
        stripeConfig: {
          enabled: true,
          secretKey: "sk_test_stub_key",
          publishableKey: "pk_test_stub_key",
          webhookSecret: "whsec_test_stub",
        },
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/subscription/cancel", {
          method: "POST",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("No active subscription");
    });

    it("should return 404 when only canceled subscription exists", async () => {
      const user = await createTestUser("cancel-sub-user3", "cancel-sub-user3@test.com");

      await updateSystemSettings({
        stripeConfig: {
          enabled: true,
          secretKey: "sk_test_stub_key",
          publishableKey: "pk_test_stub_key",
          webhookSecret: "whsec_test_stub",
        },
      });

      const now = new Date();
      await SubscriptionModel.create({
        userId: new Types.ObjectId(user.id),
        stripeSubscriptionId: "sub_already_canceled",
        stripeCustomerId: "cus_test_001",
        stripePriceId: "price_test_001",
        planId: "plan_basic",
        status: SubscriptionStatus.CANCELED,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        metadata: {},
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/subscription/cancel", {
          method: "POST",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(404);
    });
  });
});
