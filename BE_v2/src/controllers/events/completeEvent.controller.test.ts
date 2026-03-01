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

describe("Complete Event Controller", () => {
  describe("PUT /api/v1/events/:eventId/complete", () => {
    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/000000000000000000000001/complete",
          { method: "PUT" }
        )
      );
      expect(response.status).toBe(401);
    });

    it("should reject if caller is not the expert", async () => {
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
          `http://localhost/api/v1/events/${event._id.toString()}/complete`,
          {
            method: "PUT",
            headers: authHeader(customer.token),
          }
        )
      );

      expect(response.status).toBe(403);
    });

    it("state machine: cannot complete a pending event", async () => {
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
        status: "pending",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/complete`,
          {
            method: "PUT",
            headers: authHeader(expert.token),
          }
        )
      );

      expect(response.status).toBe(400);
    });

    it("should complete an accepted event", async () => {
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
        title: "Session to Complete",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/complete`,
          {
            method: "PUT",
            headers: authHeader(expert.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.event.status).toBe("completed");

      const updated = await EventModel.findById(event._id);
      expect(updated?.status).toBe("completed");
    });

    it("should calculate totalTimeSpent when start and end are set", async () => {
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

      const start = new Date("2026-03-01T10:00:00Z");
      const end = new Date("2026-03-01T11:30:00Z"); // 90 minutes

      const event = await EventModel.create({
        expert: expert.id,
        customer: customer.id,
        status: "accepted",
        start,
        end,
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}/complete`,
          {
            method: "PUT",
            headers: authHeader(expert.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.event.totalTimeSpent).toBe(90);
    });
  });
});
