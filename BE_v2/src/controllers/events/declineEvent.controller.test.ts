import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import {
  authHeader,
  createTestUser,
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

describe("Decline Event Controller", () => {
  describe("PUT /api/v1/events/:eventId/decline", () => {
    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/000000000000000000000001/decline",
          { method: "PUT" }
        )
      );
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent event", async () => {
      const customer = await createTestUser(
        "cust1",
        "cust1@test.com",
        UserRole.CUSTOMER
      );

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/000000000000000000000001/decline",
          {
            method: "PUT",
            headers: authHeader(customer.token),
          }
        )
      );

      expect(response.status).toBe(404);
    });

    it("should reject if caller is not a participant", async () => {
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
      const outsider = await createTestUser(
        "outsider2",
        "outsider2@test.com",
        UserRole.CUSTOMER
      );

      const event = await EventModel.create({
        expert: expert.id,
        customer: customer.id,
        status: "pending",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/decline`,
          {
            method: "PUT",
            headers: authHeader(outsider.token),
          }
        )
      );

      expect(response.status).toBe(403);
    });

    it("should reject if event is not in pending status", async () => {
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
        status: "accepted",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/decline`,
          {
            method: "PUT",
            headers: authHeader(customer.token),
          }
        )
      );

      expect(response.status).toBe(400);
    });

    it("should decline a pending event", async () => {
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
        status: "pending",
        title: "Session to Decline",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/decline`,
          {
            method: "PUT",
            headers: authHeader(customer.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.event.status).toBe("declined");

      const updated = await EventModel.findById(event._id);
      expect(updated?.status).toBe("declined");
    });

    it("state machine: cannot decline an already-declined event", async () => {
      const expert = await createTestUser(
        "expert5",
        "expert5@test.com",
        UserRole.EXPERT
      );
      const customer = await createTestUser(
        "cust5",
        "cust5@test.com",
        UserRole.CUSTOMER
      );

      const event = await EventModel.create({
        expert: expert.id,
        customer: customer.id,
        status: "declined",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/decline`,
          {
            method: "PUT",
            headers: authHeader(customer.token),
          }
        )
      );

      expect(response.status).toBe(400);
    });
  });
});
