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

describe("Get Calendar Controller", () => {
  describe("GET /api/v1/events/calendar", () => {
    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/calendar?startDate=2026-01-01&endDate=2026-12-31",
          { method: "GET" }
        )
      );
      expect(response.status).toBe(401);
    });

    it("should return 422 when startDate is missing", async () => {
      const expert = await createTestUser(
        "expert1",
        "expert1@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/calendar?endDate=2026-12-31",
          {
            method: "GET",
            headers: authHeader(expert.token),
          }
        )
      );

      expect(response.status).toBe(422);
    });

    it("should return 422 when endDate is missing", async () => {
      const expert = await createTestUser(
        "expert2",
        "expert2@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/calendar?startDate=2026-01-01",
          {
            method: "GET",
            headers: authHeader(expert.token),
          }
        )
      );

      expect(response.status).toBe(422);
    });

    it("should return events in the date range", async () => {
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
          title: "Event in range",
          start: new Date("2026-03-15T10:00:00Z"),
          createdBy: expert.id,
        },
        {
          expert: expert.id,
          customer: customer.id,
          status: "accepted",
          title: "Event in range 2",
          start: new Date("2026-03-20T14:00:00Z"),
          createdBy: expert.id,
        },
        {
          expert: expert.id,
          customer: customer.id,
          status: "pending",
          title: "Event out of range",
          start: new Date("2026-04-15T10:00:00Z"),
          createdBy: expert.id,
        },
      ]);

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/calendar?startDate=2026-03-01&endDate=2026-03-31",
          {
            method: "GET",
            headers: authHeader(expert.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toHaveLength(2);
    });

    it("should only include pending, accepted, and completed events", async () => {
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
          start: new Date("2026-03-10T10:00:00Z"),
          createdBy: expert.id,
        },
        {
          expert: expert.id,
          customer: customer.id,
          status: "accepted",
          start: new Date("2026-03-11T10:00:00Z"),
          createdBy: expert.id,
        },
        {
          expert: expert.id,
          customer: customer.id,
          status: "completed",
          start: new Date("2026-03-12T10:00:00Z"),
          createdBy: expert.id,
        },
        {
          expert: expert.id,
          customer: customer.id,
          status: "declined",
          start: new Date("2026-03-13T10:00:00Z"),
          createdBy: expert.id,
        },
        {
          expert: expert.id,
          customer: customer.id,
          status: "cancelled",
          start: new Date("2026-03-14T10:00:00Z"),
          createdBy: expert.id,
        },
      ]);

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/calendar?startDate=2026-03-01&endDate=2026-03-31",
          {
            method: "GET",
            headers: authHeader(expert.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      // Only pending, accepted, completed (3 events)
      expect(data.events).toHaveLength(3);
      const statuses = data.events.map(
        (e: { status: string }) => e.status
      );
      expect(statuses).not.toContain("declined");
      expect(statuses).not.toContain("cancelled");
    });

    it("should return event fields for calendar display", async () => {
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

      await EventModel.create({
        expert: expert.id,
        customer: customer.id,
        status: "accepted",
        title: "Calendar Event",
        start: new Date("2026-03-15T10:00:00Z"),
        end: new Date("2026-03-15T11:00:00Z"),
        createdBy: expert.id,
      });

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/events/calendar?startDate=2026-03-01&endDate=2026-03-31",
          {
            method: "GET",
            headers: authHeader(expert.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toHaveLength(1);
      const calEvent = data.events[0];
      expect(calEvent.title).toBe("Calendar Event");
      expect(calEvent.status).toBe("accepted");
      expect(calEvent.expert.username).toBe("expert5");
      expect(calEvent.customer.username).toBe("cust5");
    });
  });
});
