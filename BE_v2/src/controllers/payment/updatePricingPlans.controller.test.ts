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

const TEST_PLAN = {
  id: "plan_test_001",
  name: "Basic Plan",
  description: "A basic plan for testing",
  stripePriceId: "price_test_001",
  type: "subscription" as const,
  currency: "usd",
  amount: 999,
  interval: "month" as const,
  features: ["feature1", "feature2"],
  isActive: true,
  createdAt: new Date().toISOString(),
};

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

describe("Update Pricing Plans Controller", () => {
  describe("PUT /api/v1/payment/plans", () => {
    it("should reject request without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plans: [TEST_PLAN] }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject non-admin users", async () => {
      const customer = await createTestUser(
        "upd-plans-cust",
        "upd-plans-cust@test.com",
        UserRole.CUSTOMER
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/plans", {
          method: "PUT",
          headers: jsonHeaders(customer.token),
          body: JSON.stringify({ plans: [TEST_PLAN] }),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should reject request with missing plans field", async () => {
      const admin = await createTestUser(
        "upd-plans-admin1",
        "upd-plans-admin1@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/plans", {
          method: "PUT",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(422);
    });

    it("should update pricing plans for admin user", async () => {
      const admin = await createTestUser(
        "upd-plans-admin2",
        "upd-plans-admin2@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/plans", {
          method: "PUT",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ plans: [TEST_PLAN] }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBeDefined();

      // Verify DB was updated
      const settings = await getSystemSettings();
      expect(settings.stripePricing.plans).toHaveLength(1);
      expect(settings.stripePricing.plans[0].id).toBe("plan_test_001");
      expect(settings.stripePricing.plans[0].name).toBe("Basic Plan");
    });

    it("should replace all existing plans", async () => {
      const admin = await createTestUser(
        "upd-plans-admin3",
        "upd-plans-admin3@test.com",
        UserRole.ADMIN
      );

      // Set initial plan
      await app.handle(
        new Request("http://localhost/api/v1/payment/plans", {
          method: "PUT",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ plans: [TEST_PLAN] }),
        })
      );

      // Replace with two plans
      const newPlans = [
        { ...TEST_PLAN, id: "plan_new_001", name: "New Plan 1" },
        {
          ...TEST_PLAN,
          id: "plan_new_002",
          name: "New Plan 2",
          stripePriceId: "price_new_002",
          type: "one_time" as const,
          interval: undefined,
        },
      ];

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/plans", {
          method: "PUT",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ plans: newPlans }),
        })
      );

      expect(response.status).toBe(200);

      const settings = await getSystemSettings();
      expect(settings.stripePricing.plans).toHaveLength(2);
      expect(settings.stripePricing.plans[0].id).toBe("plan_new_001");
      expect(settings.stripePricing.plans[1].id).toBe("plan_new_002");
    });

    it("should allow setting empty plans list", async () => {
      const admin = await createTestUser(
        "upd-plans-admin4",
        "upd-plans-admin4@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/plans", {
          method: "PUT",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ plans: [] }),
        })
      );

      expect(response.status).toBe(200);

      const settings = await getSystemSettings();
      expect(settings.stripePricing.plans).toHaveLength(0);
    });
  });
});
