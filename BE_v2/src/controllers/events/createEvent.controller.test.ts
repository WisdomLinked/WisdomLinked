import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import {
  createTestUser,
  jsonHeaders,
  wipeTestDatabase,
} from "../../../test/helpers";
import { connectToDatabase } from "../../config/database";
import { UserRole } from "../../config/roles";
import { EventModel } from "../../models/Event";
import { eventRoutes } from "../../routes/v1/events";

function buildEventTestApp() {
  return new Elysia().use(eventRoutes);
}

type EventTestApp = ReturnType<typeof buildEventTestApp>;

let app: EventTestApp;

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  app = buildEventTestApp();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

describe("Create Event Controller", () => {
  describe("POST /api/v1/events", () => {
    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: "someId" }),
        })
      );
      expect(response.status).toBe(401);
    });

    it("should reject if caller is not an expert", async () => {
      const customer = await createTestUser(
        "cust1",
        "cust1@test.com",
        UserRole.CUSTOMER
      );
      const otherCustomer = await createTestUser(
        "cust2",
        "cust2@test.com",
        UserRole.CUSTOMER
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/events", {
          method: "POST",
          headers: jsonHeaders(customer.token),
          body: JSON.stringify({ customerId: otherCustomer.id }),
        })
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("expert");
    });

    it("should reject if customer not found", async () => {
      const expert = await createTestUser(
        "expert1",
        "expert1@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/events", {
          method: "POST",
          headers: jsonHeaders(expert.token),
          body: JSON.stringify({
            customerId: "000000000000000000000001",
          }),
        })
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("Customer not found");
    });

    it("should reject if target user is not a customer", async () => {
      const expert = await createTestUser(
        "expert2",
        "expert2@test.com",
        UserRole.EXPERT
      );
      const anotherExpert = await createTestUser(
        "expert3",
        "expert3@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/events", {
          method: "POST",
          headers: jsonHeaders(expert.token),
          body: JSON.stringify({ customerId: anotherExpert.id }),
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("not a customer");
    });

    it("should create event successfully", async () => {
      const expert = await createTestUser(
        "expert4",
        "expert4@test.com",
        UserRole.EXPERT
      );
      const customer = await createTestUser(
        "cust4",
        "cust4@test.com",
        UserRole.CUSTOMER
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/events", {
          method: "POST",
          headers: jsonHeaders(expert.token),
          body: JSON.stringify({
            customerId: customer.id,
            title: "Test Session",
            price: 100,
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.event).toBeDefined();
      expect(data.event.status).toBe("pending");
      expect(data.event.title).toBe("Test Session");
      expect(data.event.expert).toBe(expert.id);
      expect(data.event.customer).toBe(customer.id);

      const dbEvent = await EventModel.findById(data.event.id);
      expect(dbEvent).not.toBeNull();
      expect(dbEvent?.status).toBe("pending");
    });

    it("should require valid body", async () => {
      const expert = await createTestUser(
        "expert5",
        "expert5@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/events", {
          method: "POST",
          headers: jsonHeaders(expert.token),
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(422);
    });
  });
});
