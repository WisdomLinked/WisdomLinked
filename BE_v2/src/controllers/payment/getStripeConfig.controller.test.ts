import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { connectToDatabase } from "../../config/database";
import { createTestUser, wipeTestDatabase, authHeader } from "../../../test/helpers";
import { paymentRoutes } from "../../routes/v1/payment";
import { UserRole } from "../../config/roles";
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

describe("Get Stripe Config Controller", () => {
  describe("GET /api/v1/payment/config", () => {
    it("should reject request without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject non-admin users", async () => {
      const customer = await createTestUser(
        "stripe-cfg-cust",
        "stripe-cfg-cust@test.com",
        UserRole.CUSTOMER
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "GET",
          headers: authHeader(customer.token),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should reject expert users", async () => {
      const expert = await createTestUser(
        "stripe-cfg-expert",
        "stripe-cfg-expert@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "GET",
          headers: authHeader(expert.token),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should return Stripe config for admin user", async () => {
      const admin = await createTestUser(
        "stripe-cfg-admin",
        "stripe-cfg-admin@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "GET",
          headers: authHeader(admin.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.config).toBeDefined();
      expect(typeof data.config.enabled).toBe("boolean");
    });

    it("should mask the secret key value", async () => {
      const admin = await createTestUser(
        "stripe-cfg-admin2",
        "stripe-cfg-admin2@test.com",
        UserRole.ADMIN
      );

      await updateSystemSettings({
        stripeConfig: {
          publishableKey: "pk_test_example",
          secretKey: "sk_test_abc123xyz",
          webhookSecret: "whsec_testvalue",
          enabled: true,
        },
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "GET",
          headers: authHeader(admin.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      // Secret key must be masked — only last 4 chars visible
      expect(data.config.secretKey).toContain("sk_***");
      expect(data.config.secretKey).not.toBe("sk_test_abc123xyz");
      // Webhook secret must be masked
      expect(data.config.webhookSecret).toContain("whsec_***");
      // Enabled flag should be returned as-is
      expect(data.config.enabled).toBe(true);
    });

    it("should return plans alongside config", async () => {
      const admin = await createTestUser(
        "stripe-cfg-admin3",
        "stripe-cfg-admin3@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "GET",
          headers: authHeader(admin.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.plans).toBeDefined();
      expect(Array.isArray(data.plans)).toBe(true);
    });
  });
});
