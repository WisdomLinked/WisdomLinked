import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { connectToDatabase } from "../../config/database";
import { wipeTestDatabase } from "../../../test/helpers";
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

describe("Get Pricing Plans Controller", () => {
  describe("GET /api/v1/payment/pricing", () => {
    it("should return empty plans list when no plans are configured", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/pricing", {
          method: "GET",
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.plans).toBeDefined();
      expect(Array.isArray(data.plans)).toBe(true);
      expect(data.plans).toHaveLength(0);
    });

    it("should return only active plans", async () => {
      await updateSystemSettings({
        stripePricing: {
          plans: [
            {
              id: "plan_active",
              name: "Active Plan",
              description: "An active plan",
              stripePriceId: "price_active_123",
              type: "subscription",
              currency: "usd",
              amount: 999,
              interval: "month",
              features: ["feature1"],
              isActive: true,
              createdAt: new Date(),
            },
            {
              id: "plan_inactive",
              name: "Inactive Plan",
              description: "An inactive plan",
              stripePriceId: "price_inactive_123",
              type: "one_time",
              currency: "usd",
              amount: 4999,
              features: [],
              isActive: false,
              createdAt: new Date(),
            },
          ],
        },
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/pricing", {
          method: "GET",
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.plans).toHaveLength(1);
      expect(data.plans[0].id).toBe("plan_active");
      expect(data.plans[0].name).toBe("Active Plan");
      expect(data.plans[0].amount).toBe(999);
    });

    it("should return all plan fields", async () => {
      await updateSystemSettings({
        stripePricing: {
          plans: [
            {
              id: "plan_full",
              name: "Full Plan",
              description: "A complete plan",
              stripePriceId: "price_full_123",
              type: "subscription",
              currency: "usd",
              amount: 1999,
              interval: "year",
              features: ["featureA", "featureB"],
              isActive: true,
              createdAt: new Date(),
            },
          ],
        },
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/pricing", {
          method: "GET",
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.plans).toHaveLength(1);

      const plan = data.plans[0];
      expect(plan.id).toBe("plan_full");
      expect(plan.name).toBe("Full Plan");
      expect(plan.description).toBe("A complete plan");
      expect(plan.type).toBe("subscription");
      expect(plan.currency).toBe("usd");
      expect(plan.amount).toBe(1999);
      expect(plan.interval).toBe("year");
      expect(plan.features).toEqual(["featureA", "featureB"]);
    });

    it("should be accessible without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/pricing", {
          method: "GET",
        })
      );
      // No auth header — must still return 200
      expect(response.status).toBe(200);
    });
  });
});
