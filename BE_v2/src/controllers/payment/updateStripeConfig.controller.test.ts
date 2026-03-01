import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { connectToDatabase } from "../../config/database";
import { createTestUser, wipeTestDatabase, jsonHeaders } from "../../../test/helpers";
import { paymentRoutes } from "../../routes/v1/payment";
import { UserRole } from "../../config/roles";
import { getSystemSettings } from "../../models/SystemSettings";

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

describe("Update Stripe Config Controller", () => {
  describe("PUT /api/v1/payment/config", () => {
    it("should reject request without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject non-admin users", async () => {
      const customer = await createTestUser(
        "upd-stripe-cust",
        "upd-stripe-cust@test.com",
        UserRole.CUSTOMER
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "PUT",
          headers: jsonHeaders(customer.token),
          body: JSON.stringify({ enabled: false }),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should reject request without required enabled field", async () => {
      const admin = await createTestUser(
        "upd-stripe-admin1",
        "upd-stripe-admin1@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "PUT",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ publishableKey: "pk_test" }),
        })
      );

      expect(response.status).toBe(422);
    });

    it("should update Stripe config for admin user", async () => {
      const admin = await createTestUser(
        "upd-stripe-admin2",
        "upd-stripe-admin2@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "PUT",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({
            enabled: true,
            publishableKey: "pk_test_newkey",
            secretKey: "sk_test_newkey",
            webhookSecret: "whsec_newkey",
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBeDefined();

      // Verify DB was updated
      const settings = await getSystemSettings();
      expect(settings.stripeConfig.enabled).toBe(true);
      expect(settings.stripeConfig.publishableKey).toBe("pk_test_newkey");
    });

    it("should allow disabling Stripe with only the enabled field", async () => {
      const admin = await createTestUser(
        "upd-stripe-admin3",
        "upd-stripe-admin3@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "PUT",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ enabled: false }),
        })
      );

      expect(response.status).toBe(200);

      const settings = await getSystemSettings();
      expect(settings.stripeConfig.enabled).toBe(false);
    });

    it("should reject expert users", async () => {
      const expert = await createTestUser(
        "upd-stripe-expert",
        "upd-stripe-expert@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/config", {
          method: "PUT",
          headers: jsonHeaders(expert.token),
          body: JSON.stringify({ enabled: true }),
        })
      );

      expect(response.status).toBe(403);
    });
  });
});
