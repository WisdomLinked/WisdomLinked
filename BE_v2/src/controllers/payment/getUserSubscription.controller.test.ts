import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { Types } from "mongoose";
import { connectToDatabase } from "../../config/database";
import { createTestUser, wipeTestDatabase, authHeader } from "../../../test/helpers";
import { paymentRoutes } from "../../routes/v1/payment";
import { SubscriptionModel, SubscriptionStatus } from "../../models/Subscription";

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

describe("Get User Subscription Controller", () => {
  describe("GET /api/v1/payment/subscription", () => {
    it("should reject request without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/subscription", {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should return null subscription when user has no active subscription", async () => {
      const user = await createTestUser("sub-user1", "sub-user1@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/subscription", {
          method: "GET",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.subscription).toBeNull();
    });

    it("should return active subscription for authenticated user", async () => {
      const user = await createTestUser("sub-user2", "sub-user2@test.com");

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await SubscriptionModel.create({
        userId: new Types.ObjectId(user.id),
        stripeSubscriptionId: "sub_test_active_001",
        stripeCustomerId: "cus_test_001",
        stripePriceId: "price_test_001",
        planId: "plan_basic",
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        metadata: {},
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/subscription", {
          method: "GET",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.subscription).not.toBeNull();
      expect(data.subscription.planId).toBe("plan_basic");
      expect(data.subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(data.subscription.cancelAtPeriodEnd).toBe(false);
    });

    it("should return trialing subscription", async () => {
      const user = await createTestUser("sub-user3", "sub-user3@test.com");

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      await SubscriptionModel.create({
        userId: new Types.ObjectId(user.id),
        stripeSubscriptionId: "sub_test_trialing_001",
        stripeCustomerId: "cus_test_002",
        stripePriceId: "price_test_001",
        planId: "plan_pro",
        status: SubscriptionStatus.TRIALING,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        metadata: {},
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/subscription", {
          method: "GET",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.subscription).not.toBeNull();
      expect(data.subscription.status).toBe(SubscriptionStatus.TRIALING);
    });

    it("should not return canceled subscriptions", async () => {
      const user = await createTestUser("sub-user4", "sub-user4@test.com");

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await SubscriptionModel.create({
        userId: new Types.ObjectId(user.id),
        stripeSubscriptionId: "sub_test_canceled_001",
        stripeCustomerId: "cus_test_003",
        stripePriceId: "price_test_001",
        planId: "plan_basic",
        status: SubscriptionStatus.CANCELED,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        metadata: {},
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/subscription", {
          method: "GET",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.subscription).toBeNull();
    });
  });
});
