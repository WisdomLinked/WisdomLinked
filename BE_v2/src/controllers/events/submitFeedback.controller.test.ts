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
import { UserModel } from "../../models/User";
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

describe("Submit Feedback Controller", () => {
  describe("POST /api/v1/events/:eventId/feedback", () => {
    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/000000000000000000000001/feedback",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rating: 5 }),
          }
        )
      );
      expect(response.status).toBe(401);
    });

    it("should reject if event is not completed", async () => {
      const expert = await createTestUser(
        "expert1",
        "expert1@test.com",
        UserRole.EXPERT
      );
      const customer = await createTestUser(
        "cust1",
        "cust1@test.com",
        UserRole.CUSTOMER
      );

      const event = await EventModel.create({
        expert: expert.id,
        customer: customer.id,
        status: "accepted",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/feedback`,
          {
            method: "POST",
            headers: jsonHeaders(customer.token),
            body: JSON.stringify({ rating: 5 }),
          }
        )
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("completed");
    });

    it("should reject if caller is not the customer", async () => {
      const expert = await createTestUser(
        "expert2",
        "expert2@test.com",
        UserRole.EXPERT
      );
      const customer = await createTestUser(
        "cust2",
        "cust2@test.com",
        UserRole.CUSTOMER
      );

      const event = await EventModel.create({
        expert: expert.id,
        customer: customer.id,
        status: "completed",
        createdBy: expert.id,
      });

      // Expert tries to submit feedback
      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/feedback`,
          {
            method: "POST",
            headers: jsonHeaders(expert.token),
            body: JSON.stringify({ rating: 5 }),
          }
        )
      );

      expect(response.status).toBe(403);
    });

    it("should submit feedback and update expert rating", async () => {
      const expert = await createTestUser(
        "expert3",
        "expert3@test.com",
        UserRole.EXPERT
      );
      const customer = await createTestUser(
        "cust3",
        "cust3@test.com",
        UserRole.CUSTOMER
      );

      const event = await EventModel.create({
        expert: expert.id,
        customer: customer.id,
        status: "completed",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/feedback`,
          {
            method: "POST",
            headers: jsonHeaders(customer.token),
            body: JSON.stringify({ rating: 4, comment: "Great session!" }),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Feedback submitted");

      // Verify expert rating updated
      const updatedExpert = await UserModel.findById(expert.id);
      expect(updatedExpert?.feedbacks).toHaveLength(1);
      expect(updatedExpert?.feedbacks[0].rating).toBe(4);
      expect(updatedExpert?.rating).toBe(4);

      // Verify event feedbacks updated
      const updatedEvent = await EventModel.findById(event._id);
      expect(updatedEvent?.feedbacks).toHaveLength(1);
    });

    it("should reject duplicate feedback", async () => {
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

      const event = await EventModel.create({
        expert: expert.id,
        customer: customer.id,
        status: "completed",
        createdBy: expert.id,
      });

      // Submit first feedback
      await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/feedback`,
          {
            method: "POST",
            headers: jsonHeaders(customer.token),
            body: JSON.stringify({ rating: 5 }),
          }
        )
      );

      // Try to submit again
      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/feedback`,
          {
            method: "POST",
            headers: jsonHeaders(customer.token),
            body: JSON.stringify({ rating: 3 }),
          }
        )
      );

      expect(response.status).toBe(409);
    });

    it("should correctly recalculate expert average rating from multiple events", async () => {
      const expert = await createTestUser(
        "expert5",
        "expert5@test.com",
        UserRole.EXPERT
      );
      const customer1 = await createTestUser(
        "cust5a",
        "cust5a@test.com",
        UserRole.CUSTOMER
      );
      const customer2 = await createTestUser(
        "cust5b",
        "cust5b@test.com",
        UserRole.CUSTOMER
      );

      const event1 = await EventModel.create({
        expert: expert.id,
        customer: customer1.id,
        status: "completed",
        createdBy: expert.id,
      });
      const event2 = await EventModel.create({
        expert: expert.id,
        customer: customer2.id,
        status: "completed",
        createdBy: expert.id,
      });

      // Customer 1 submits rating 4
      await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event1._id.toString()}/feedback`,
          {
            method: "POST",
            headers: jsonHeaders(customer1.token),
            body: JSON.stringify({ rating: 4 }),
          }
        )
      );

      // Customer 2 submits rating 2
      await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event2._id.toString()}/feedback`,
          {
            method: "POST",
            headers: jsonHeaders(customer2.token),
            body: JSON.stringify({ rating: 2 }),
          }
        )
      );

      // Average should be (4 + 2) / 2 = 3
      const updatedExpert = await UserModel.findById(expert.id);
      expect(updatedExpert?.rating).toBe(3);
      expect(updatedExpert?.feedbacks).toHaveLength(2);
    });

    it("should require valid rating schema", async () => {
      const expert = await createTestUser(
        "expert6",
        "expert6@test.com",
        UserRole.EXPERT
      );
      const customer = await createTestUser(
        "cust6",
        "cust6@test.com",
        UserRole.CUSTOMER
      );

      const event = await EventModel.create({
        expert: expert.id,
        customer: customer.id,
        status: "completed",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/feedback`,
          {
            method: "POST",
            headers: jsonHeaders(customer.token),
            body: JSON.stringify({}),
          }
        )
      );

      expect(response.status).toBe(422);
    });
  });
});
