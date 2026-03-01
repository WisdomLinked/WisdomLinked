import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { Types } from "mongoose";
import { connectToDatabase } from "../../config/database";
import { createTestUser, wipeTestDatabase, jsonHeaders, authHeader } from "../../../test/helpers";
import { paymentRoutes } from "../../routes/v1/payment";
import { UserRole } from "../../config/roles";
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

describe("Refund Payment Controller", () => {
  describe("POST /api/v1/payment/refund", () => {
    it("should reject request without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/refund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: "pi_test_001" }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject non-admin users (customer)", async () => {
      const customer = await createTestUser(
        "refund-cust",
        "refund-cust@test.com",
        UserRole.CUSTOMER
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/refund", {
          method: "POST",
          headers: jsonHeaders(customer.token),
          body: JSON.stringify({ paymentIntentId: "pi_test_001" }),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should reject non-admin users (expert)", async () => {
      const expert = await createTestUser(
        "refund-expert",
        "refund-expert@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/refund", {
          method: "POST",
          headers: jsonHeaders(expert.token),
          body: JSON.stringify({ paymentIntentId: "pi_test_001" }),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should reject request with missing paymentIntentId", async () => {
      const admin = await createTestUser(
        "refund-admin1",
        "refund-admin1@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/refund", {
          method: "POST",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ amount: 500 }),
        })
      );

      expect(response.status).toBe(422);
    });

    it("should return 404 when payment is not found in DB", async () => {
      const admin = await createTestUser(
        "refund-admin2",
        "refund-admin2@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/refund", {
          method: "POST",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ paymentIntentId: "pi_nonexistent_001" }),
        })
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("Payment not found");
    });

    it("should fail with 500 when Stripe API call fails (test key)", async () => {
      const admin = await createTestUser(
        "refund-admin3",
        "refund-admin3@test.com",
        UserRole.ADMIN
      );
      const customer = await createTestUser("refund-customer3", "refund-customer3@test.com");

      // Seed a payment record that exists in the DB
      await PaymentModel.create({
        userId: new Types.ObjectId(customer.id),
        stripePaymentIntentId: "pi_test_to_refund_001",
        stripeCustomerId: "cus_test_001",
        type: PaymentType.ONE_TIME,
        status: PaymentStatus.SUCCEEDED,
        amount: 1999,
        currency: "usd",
        description: "Payment to be refunded",
        metadata: {},
      });

      // Stripe will fail (test key cannot call real API) — expect 500
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/refund", {
          method: "POST",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ paymentIntentId: "pi_test_to_refund_001" }),
        })
      );

      // 500 is expected because the Stripe test key cannot call the real Stripe API
      expect(response.status).toBe(500);
    });

    it("should be accessible only via POST with auth header", async () => {
      const admin = await createTestUser(
        "refund-admin4",
        "refund-admin4@test.com",
        UserRole.ADMIN
      );

      // GET request should not match (Elysia route is POST only)
      const getResponse = await app.handle(
        new Request("http://localhost/api/v1/payment/refund", {
          method: "GET",
          headers: authHeader(admin.token),
        })
      );

      expect(getResponse.status).toBe(404);
    });
  });
});
