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

describe("Handle Stripe Webhook Controller", () => {
  describe("POST /api/v1/payment/webhook", () => {
    it("should return 400 when stripe-signature header is missing", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "checkout.session.completed" }),
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("stripe-signature");
    });

    it("should return 503 when webhook secret is not configured", async () => {
      await updateSystemSettings({
        stripeConfig: {
          enabled: false,
          // No webhookSecret set
        },
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": "t=fake,v1=fake",
          },
          body: JSON.stringify({ type: "checkout.session.completed" }),
        })
      );

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should return 503 when Stripe client cannot be created (no secret key)", async () => {
      await updateSystemSettings({
        stripeConfig: {
          enabled: false,
          webhookSecret: "whsec_test_secret",
          // No secretKey set
        },
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": "t=fake,v1=fake",
          },
          body: JSON.stringify({ type: "checkout.session.completed" }),
        })
      );

      expect(response.status).toBe(503);
    });

    it("should return 400 when webhook signature is invalid", async () => {
      await updateSystemSettings({
        stripeConfig: {
          enabled: true,
          secretKey: "sk_test_stub_key",
          publishableKey: "pk_test_stub_key",
          webhookSecret: "whsec_test_stub_secret",
        },
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": "t=1234567890,v1=invalidsignature",
          },
          body: JSON.stringify({ type: "checkout.session.completed" }),
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Invalid webhook signature");
    });
  });
});
