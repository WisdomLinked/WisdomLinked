import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { Types } from "mongoose";
import { connectToDatabase } from "../../config/database";
import { createTestUser, wipeTestDatabase, authHeader } from "../../../test/helpers";
import { paymentRoutes } from "../../routes/v1/payment";
import { PaymentModel, PaymentStatus, PaymentType } from "../../models/Payment";

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

describe("Get User Payments Controller", () => {
  describe("GET /api/v1/payment/history", () => {
    it("should reject request without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/history", {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should return empty list when user has no payments", async () => {
      const user = await createTestUser("pay-user1", "pay-user1@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/history", {
          method: "GET",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.payments).toBeDefined();
      expect(Array.isArray(data.payments)).toBe(true);
      expect(data.payments).toHaveLength(0);
    });

    it("should return payment history for authenticated user", async () => {
      const user = await createTestUser("pay-user2", "pay-user2@test.com");

      await PaymentModel.create({
        userId: new Types.ObjectId(user.id),
        stripePaymentIntentId: "pi_test_001",
        stripeCustomerId: "cus_test_001",
        type: PaymentType.ONE_TIME,
        status: PaymentStatus.SUCCEEDED,
        amount: 1999,
        currency: "usd",
        description: "Test payment",
        metadata: {},
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/history", {
          method: "GET",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.payments).toHaveLength(1);
      expect(data.payments[0].type).toBe(PaymentType.ONE_TIME);
      expect(data.payments[0].status).toBe(PaymentStatus.SUCCEEDED);
      expect(data.payments[0].amount).toBe(1999);
      expect(data.payments[0].currency).toBe("usd");
    });

    it("should return payments sorted by most recent first", async () => {
      const user = await createTestUser("pay-user3", "pay-user3@test.com");

      const now = new Date();
      const earlier = new Date(now.getTime() - 3600 * 1000);

      await PaymentModel.create({
        userId: new Types.ObjectId(user.id),
        stripePaymentIntentId: "pi_test_older",
        stripeCustomerId: "cus_test_001",
        type: PaymentType.ONE_TIME,
        status: PaymentStatus.SUCCEEDED,
        amount: 999,
        currency: "usd",
        description: "Older payment",
        metadata: {},
        createdAt: earlier,
      });

      await PaymentModel.create({
        userId: new Types.ObjectId(user.id),
        stripePaymentIntentId: "pi_test_newer",
        stripeCustomerId: "cus_test_001",
        type: PaymentType.ONE_TIME,
        status: PaymentStatus.SUCCEEDED,
        amount: 1999,
        currency: "usd",
        description: "Newer payment",
        metadata: {},
        createdAt: now,
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/history", {
          method: "GET",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.payments).toHaveLength(2);
      // Most recent first
      expect(data.payments[0].amount).toBe(1999);
      expect(data.payments[1].amount).toBe(999);
    });

    it("should only return payments belonging to the requesting user", async () => {
      const user1 = await createTestUser("pay-user4", "pay-user4@test.com");
      const user2 = await createTestUser("pay-user5", "pay-user5@test.com");

      await PaymentModel.create({
        userId: new Types.ObjectId(user1.id),
        stripePaymentIntentId: "pi_test_user1",
        stripeCustomerId: "cus_test_001",
        type: PaymentType.ONE_TIME,
        status: PaymentStatus.SUCCEEDED,
        amount: 500,
        currency: "usd",
        description: "User 1 payment",
        metadata: {},
      });

      await PaymentModel.create({
        userId: new Types.ObjectId(user2.id),
        stripePaymentIntentId: "pi_test_user2",
        stripeCustomerId: "cus_test_002",
        type: PaymentType.ONE_TIME,
        status: PaymentStatus.SUCCEEDED,
        amount: 750,
        currency: "usd",
        description: "User 2 payment",
        metadata: {},
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/history", {
          method: "GET",
          headers: authHeader(user1.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.payments).toHaveLength(1);
      expect(data.payments[0].amount).toBe(500);
    });
  });
});
