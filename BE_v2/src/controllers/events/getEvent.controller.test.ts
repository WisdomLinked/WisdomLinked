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

describe("Get Event Controller", () => {
  describe("GET /api/v1/events/:eventId", () => {
    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/000000000000000000000001",
          { method: "GET" }
        )
      );
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent event", async () => {
      const expert = await createTestUser(
        "expert1",
        "expert1@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/000000000000000000000001",
          {
            method: "GET",
            headers: authHeader(expert.token),
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
        "outsider",
        "outsider@test.com",
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
          `http://localhost/api/v1/events/${event._id.toString()}`,
          {
            method: "GET",
            headers: authHeader(outsider.token),
          }
        )
      );

      expect(response.status).toBe(403);
    });

    it("should return event for expert participant", async () => {
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
        title: "Expert Session",
        status: "pending",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}`,
          {
            method: "GET",
            headers: authHeader(expert.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.event.id).toBe(event._id.toString());
      expect(data.event.title).toBe("Expert Session");
      expect(data.event.expert.username).toBe("expert3");
      expect(data.event.customer.username).toBe("cust3");
    });

    it("should return event for customer participant", async () => {
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
        title: "Customer Session",
        status: "accepted",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}`,
          {
            method: "GET",
            headers: authHeader(customer.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.event.status).toBe("accepted");
    });

    it("should return event for admin", async () => {
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
      const admin = await createTestUser(
        "admin5",
        "admin5@test.com",
        UserRole.ADMIN
      );

      const event = await EventModel.create({
        expert: expert.id,
        customer: customer.id,
        status: "pending",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/events/${event._id.toString()}`,
          {
            method: "GET",
            headers: authHeader(admin.token),
          }
        )
      );

      expect(response.status).toBe(200);
    });
  });
});
