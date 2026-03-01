import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { Types } from "mongoose";
import { connectToDatabase } from "../../config/database";
import { createTestUser, wipeTestDatabase, jsonHeaders } from "../../../test/helpers";
import { paymentRoutes } from "../../routes/v1/payment";
import { UserRole } from "../../config/roles";
import { EventModel } from "../../models/Event";

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

describe("Create Event Payment Controller", () => {
  describe("POST /api/v1/payment/event", () => {
    it("should reject request without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: "000000000000000000000001",
            amount: 1999,
            currency: "usd",
          }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject request with missing body fields", async () => {
      const user = await createTestUser("ev-pay-user1", "ev-pay-user1@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/event", {
          method: "POST",
          headers: jsonHeaders(user.token),
          body: JSON.stringify({ eventId: "000000000000000000000001" }),
        })
      );

      expect(response.status).toBe(422);
    });

    it("should return 404 when event does not exist", async () => {
      const user = await createTestUser("ev-pay-user2", "ev-pay-user2@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/event", {
          method: "POST",
          headers: jsonHeaders(user.token),
          body: JSON.stringify({
            eventId: "000000000000000000000001",
            amount: 1999,
            currency: "usd",
          }),
        })
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("Event not found");
    });

    it("should return 400 when event is not in pending status", async () => {
      const expert = await createTestUser("ev-pay-expert3", "ev-pay-expert3@test.com", UserRole.EXPERT);
      const customer = await createTestUser("ev-pay-cust3", "ev-pay-cust3@test.com");

      const acceptedEvent = await EventModel.create({
        expert: new Types.ObjectId(expert.id),
        customer: new Types.ObjectId(customer.id),
        status: "accepted",
        createdBy: new Types.ObjectId(expert.id),
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/event", {
          method: "POST",
          headers: jsonHeaders(customer.token),
          body: JSON.stringify({
            eventId: acceptedEvent._id.toString(),
            amount: 1999,
            currency: "usd",
          }),
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("not available for booking");
    });

    it("should return 400 for completed events", async () => {
      const expert = await createTestUser("ev-pay-expert4", "ev-pay-expert4@test.com", UserRole.EXPERT);
      const customer = await createTestUser("ev-pay-cust4", "ev-pay-cust4@test.com");

      const completedEvent = await EventModel.create({
        expert: new Types.ObjectId(expert.id),
        customer: new Types.ObjectId(customer.id),
        status: "completed",
        createdBy: new Types.ObjectId(expert.id),
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/event", {
          method: "POST",
          headers: jsonHeaders(customer.token),
          body: JSON.stringify({
            eventId: completedEvent._id.toString(),
            amount: 1999,
            currency: "usd",
          }),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should attempt Stripe payment for pending events (fails with test key)", async () => {
      const expert = await createTestUser("ev-pay-expert5", "ev-pay-expert5@test.com", UserRole.EXPERT);
      const customer = await createTestUser("ev-pay-cust5", "ev-pay-cust5@test.com");

      const pendingEvent = await EventModel.create({
        expert: new Types.ObjectId(expert.id),
        customer: new Types.ObjectId(customer.id),
        status: "pending",
        title: "Bookable Session",
        price: 1999,
        createdBy: new Types.ObjectId(expert.id),
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/event", {
          method: "POST",
          headers: jsonHeaders(customer.token),
          body: JSON.stringify({
            eventId: pendingEvent._id.toString(),
            amount: 1999,
            currency: "usd",
          }),
        })
      );

      // Reaches Stripe call — fails with 500 since test key cannot call real API
      // but it MUST NOT return 401, 404, or 400 (all validation passed)
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(400);
    });

    it("should allow any authenticated role to pay for a pending event", async () => {
      const expert = await createTestUser("ev-pay-expert6", "ev-pay-expert6@test.com", UserRole.EXPERT);
      const customer = await createTestUser("ev-pay-cust6", "ev-pay-cust6@test.com", UserRole.CUSTOMER);

      const pendingEvent = await EventModel.create({
        expert: new Types.ObjectId(expert.id),
        customer: new Types.ObjectId(customer.id),
        status: "pending",
        createdBy: new Types.ObjectId(expert.id),
      });

      // Customer should be allowed (not forbidden)
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/event", {
          method: "POST",
          headers: jsonHeaders(customer.token),
          body: JSON.stringify({
            eventId: pendingEvent._id.toString(),
            amount: 500,
            currency: "usd",
          }),
        })
      );

      expect(response.status).not.toBe(403);
    });
  });
});
