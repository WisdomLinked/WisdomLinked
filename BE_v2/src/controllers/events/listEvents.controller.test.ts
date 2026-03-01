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

describe("List Events Controller", () => {
  describe("GET /api/v1/events", () => {
    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/events", { method: "GET" })
      );
      expect(response.status).toBe(401);
    });

    it("should return events for the authenticated user", async () => {
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

      await EventModel.create([
        {
          expert: expert.id,
          customer: customer.id,
          status: "pending",
          createdBy: expert.id,
        },
        {
          expert: expert.id,
          customer: customer.id,
          status: "accepted",
          createdBy: expert.id,
        },
      ]);

      const response = await app.handle(
        new Request("http://localhost/api/v1/events", {
          method: "GET",
          headers: authHeader(expert.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
      expect(data.totalPages).toBe(1);
    });

    it("should filter by role=as-expert", async () => {
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
      const otherExpert = await createTestUser(
        "expert2b",
        "expert2b@test.com",
        UserRole.EXPERT
      );

      await EventModel.create([
        {
          expert: expert.id,
          customer: customer.id,
          status: "pending",
          createdBy: expert.id,
        },
        {
          expert: otherExpert.id,
          customer: customer.id,
          status: "pending",
          createdBy: otherExpert.id,
        },
      ]);

      const response = await app.handle(
        new Request("http://localhost/api/v1/events?role=as-expert", {
          method: "GET",
          headers: authHeader(expert.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toHaveLength(1);
      expect(data.events[0].expert.id).toBe(expert.id);
    });

    it("should filter by role=as-customer", async () => {
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

      await EventModel.create([
        {
          expert: expert.id,
          customer: customer.id,
          status: "pending",
          createdBy: expert.id,
        },
      ]);

      const response = await app.handle(
        new Request("http://localhost/api/v1/events?role=as-customer", {
          method: "GET",
          headers: authHeader(customer.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toHaveLength(1);
      expect(data.events[0].customer.id).toBe(customer.id);
    });

    it("should filter by status", async () => {
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

      await EventModel.create([
        {
          expert: expert.id,
          customer: customer.id,
          status: "pending",
          createdBy: expert.id,
        },
        {
          expert: expert.id,
          customer: customer.id,
          status: "accepted",
          createdBy: expert.id,
        },
      ]);

      const response = await app.handle(
        new Request("http://localhost/api/v1/events?status=accepted", {
          method: "GET",
          headers: authHeader(expert.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toHaveLength(1);
      expect(data.events[0].status).toBe("accepted");
    });

    it("should return 400 for invalid status", async () => {
      const expert = await createTestUser(
        "expert5",
        "expert5@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/events?status=invalid_status", {
          method: "GET",
          headers: authHeader(expert.token),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should paginate results", async () => {
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

      await EventModel.create(
        Array.from({ length: 5 }, () => ({
          expert: expert.id,
          customer: customer.id,
          status: "pending",
          createdBy: expert.id,
        }))
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/events?page=1&limit=2", {
          method: "GET",
          headers: authHeader(expert.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toHaveLength(2);
      expect(data.total).toBe(5);
      expect(data.totalPages).toBe(3);
      expect(data.page).toBe(1);
    });

    it("admin should see all events", async () => {
      const expert = await createTestUser(
        "expert7",
        "expert7@test.com",
        UserRole.EXPERT
      );
      const customer = await createTestUser(
        "cust7",
        "cust7@test.com",
        UserRole.CUSTOMER
      );
      const admin = await createTestUser(
        "admin7",
        "admin7@test.com",
        UserRole.ADMIN
      );

      await EventModel.create({
        expert: expert.id,
        customer: customer.id,
        status: "pending",
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/events", {
          method: "GET",
          headers: authHeader(admin.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.total).toBe(1);
    });
  });
});
