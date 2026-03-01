import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { connectToDatabase } from "../../config/database";
import { createTestUser, wipeTestDatabase, jsonHeaders } from "../../../test/helpers";
import { paymentRoutes } from "../../routes/v1/payment";
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

describe("Create Checkout Session Controller", () => {
  describe("POST /api/v1/payment/checkout", () => {
    it("should reject request without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: "plan_basic",
            successUrl: "https://example.com/success",
            cancelUrl: "https://example.com/cancel",
          }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject request with missing body fields", async () => {
      const user = await createTestUser("checkout-user1", "checkout-user1@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/checkout", {
          method: "POST",
          headers: jsonHeaders(user.token),
          body: JSON.stringify({ planId: "plan_basic" }),
        })
      );

      expect(response.status).toBe(422);
    });

    it("should return 503 when Stripe is not configured", async () => {
      const user = await createTestUser("checkout-user2", "checkout-user2@test.com");

      // Ensure Stripe is not configured (default state — disabled)
      await updateSystemSettings({
        stripeConfig: { enabled: false },
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/checkout", {
          method: "POST",
          headers: jsonHeaders(user.token),
          body: JSON.stringify({
            planId: "plan_basic",
            successUrl: "https://example.com/success",
            cancelUrl: "https://example.com/cancel",
          }),
        })
      );

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should return 404 when plan is not found", async () => {
      const user = await createTestUser("checkout-user3", "checkout-user3@test.com");

      await updateSystemSettings({
        stripeConfig: {
          enabled: true,
          secretKey: "sk_test_stub_key",
          publishableKey: "pk_test_stub_key",
          webhookSecret: "whsec_test_stub",
        },
        stripePricing: { plans: [] },
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/checkout", {
          method: "POST",
          headers: jsonHeaders(user.token),
          body: JSON.stringify({
            planId: "plan_nonexistent",
            successUrl: "https://example.com/success",
            cancelUrl: "https://example.com/cancel",
          }),
        })
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("not found");
    });

    it("should return 404 for inactive plan", async () => {
      const user = await createTestUser("checkout-user4", "checkout-user4@test.com");

      await updateSystemSettings({
        stripeConfig: {
          enabled: true,
          secretKey: "sk_test_stub_key",
          publishableKey: "pk_test_stub_key",
          webhookSecret: "whsec_test_stub",
        },
        stripePricing: {
          plans: [
            {
              id: "plan_inactive",
              name: "Inactive Plan",
              description: "Not available",
              stripePriceId: "price_inactive",
              type: "subscription",
              currency: "usd",
              amount: 999,
              features: [],
              isActive: false,
              createdAt: new Date(),
            },
          ],
        },
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/checkout", {
          method: "POST",
          headers: jsonHeaders(user.token),
          body: JSON.stringify({
            planId: "plan_inactive",
            successUrl: "https://example.com/success",
            cancelUrl: "https://example.com/cancel",
          }),
        })
      );

      expect(response.status).toBe(404);
    });
  });
});
