import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";
import { EventModel } from "../../models/Event";
import { Types } from "mongoose";

describe("List Feedbacks Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should list feedbacks from completed events for admin", async () => {
    const admin = await createTestUser("lf-admin", "lf-admin@test.com", UserRole.ADMIN);
    const expert = await createTestUser("lf-expert", "lf-expert@test.com", UserRole.EXPERT);
    const customer = await createTestUser("lf-customer", "lf-customer@test.com");

    await EventModel.create({
      expert: new Types.ObjectId(expert.id),
      customer: new Types.ObjectId(customer.id),
      createdBy: new Types.ObjectId(expert.id),
      status: "completed",
      title: "Completed Consultation",
      feedbacks: [],
      totalTimeSpent: 60,
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/feedback", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].title).toBe("Completed Consultation");
    expect(data.data[0].status).toBe("completed");
    expect(data.pagination.total).toBe(1);
    expect(data.pagination.page).toBe(1);
  });

  it("should filter by expertId", async () => {
    const admin = await createTestUser("lf-admin2", "lf-admin2@test.com", UserRole.ADMIN);
    const expert1 = await createTestUser("lf-exp1", "lf-exp1@test.com", UserRole.EXPERT);
    const expert2 = await createTestUser("lf-exp2", "lf-exp2@test.com", UserRole.EXPERT);
    const customer = await createTestUser("lf-cust2", "lf-cust2@test.com");

    await EventModel.create([
      {
        expert: new Types.ObjectId(expert1.id),
        customer: new Types.ObjectId(customer.id),
        createdBy: new Types.ObjectId(expert1.id),
        status: "completed",
        title: "Session A",
        feedbacks: [],
        totalTimeSpent: 30,
      },
      {
        expert: new Types.ObjectId(expert2.id),
        customer: new Types.ObjectId(customer.id),
        createdBy: new Types.ObjectId(expert2.id),
        status: "completed",
        title: "Session B",
        feedbacks: [],
        totalTimeSpent: 45,
      },
    ]);

    const response = await app.handle(
      new Request(`http://localhost/api/v1/feedback?expertId=${expert1.id}`, {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].title).toBe("Session A");
  });

  it("should return 400 for invalid expertId", async () => {
    const admin = await createTestUser("lf-admin3", "lf-admin3@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/feedback?expertId=not-a-valid-id", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid expertId");
  });

  it("should paginate results", async () => {
    const admin = await createTestUser("lf-admin4", "lf-admin4@test.com", UserRole.ADMIN);
    const expert = await createTestUser("lf-exp4", "lf-exp4@test.com", UserRole.EXPERT);
    const customer = await createTestUser("lf-cust4", "lf-cust4@test.com");

    await EventModel.create([
      {
        expert: new Types.ObjectId(expert.id),
        customer: new Types.ObjectId(customer.id),
        createdBy: new Types.ObjectId(expert.id),
        status: "completed",
        title: "Session 1",
        feedbacks: [],
        totalTimeSpent: 30,
      },
      {
        expert: new Types.ObjectId(expert.id),
        customer: new Types.ObjectId(customer.id),
        createdBy: new Types.ObjectId(expert.id),
        status: "completed",
        title: "Session 2",
        feedbacks: [],
        totalTimeSpent: 30,
      },
      {
        expert: new Types.ObjectId(expert.id),
        customer: new Types.ObjectId(customer.id),
        createdBy: new Types.ObjectId(expert.id),
        status: "completed",
        title: "Session 3",
        feedbacks: [],
        totalTimeSpent: 30,
      },
    ]);

    const response = await app.handle(
      new Request("http://localhost/api/v1/feedback?page=1&limit=2", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(3);
    expect(data.pagination.totalPages).toBe(2);
    expect(data.pagination.limit).toBe(2);
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("lf-nocust", "lf-nocust@test.com");

    const response = await app.handle(
      new Request("http://localhost/api/v1/feedback", {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});
