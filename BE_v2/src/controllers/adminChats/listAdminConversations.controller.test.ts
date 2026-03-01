import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { Types } from "mongoose";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";
import { ConversationModel } from "../../models/Conversation";

describe("List Admin Conversations Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should list all conversations for admin", async () => {
    const admin = await createTestUser("lac-admin", "lac-admin@test.com", UserRole.ADMIN);
    const userA = await createTestUser("lac-usera", "lac-usera@test.com");
    const userB = await createTestUser("lac-userb", "lac-userb@test.com");

    await ConversationModel.create({
      participants: [new Types.ObjectId(userA.id), new Types.ObjectId(userB.id)],
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/admin/chats", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBe(1);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(1);
  });

  it("should filter by participant username search", async () => {
    const admin = await createTestUser("lac2-admin", "lac2-admin@test.com", UserRole.ADMIN);
    const userA = await createTestUser("alice-special", "alice-special@test.com");
    const userB = await createTestUser("bob-other", "bob-other@test.com");
    const userC = await createTestUser("charlie-other", "charlie-other@test.com");

    // Conversation between alice and bob
    await ConversationModel.create({
      participants: [new Types.ObjectId(userA.id), new Types.ObjectId(userB.id)],
    });
    // Conversation between bob and charlie (no alice)
    await ConversationModel.create({
      participants: [new Types.ObjectId(userB.id), new Types.ObjectId(userC.id)],
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/admin/chats?search=alice-special", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.data)).toBe(true);
    // Only conversations that include alice should appear
    expect(data.pagination.total).toBe(1);
  });

  it("should paginate results sorted by updatedAt desc", async () => {
    const admin = await createTestUser("lac3-admin", "lac3-admin@test.com", UserRole.ADMIN);
    const userA = await createTestUser("lac3-usera", "lac3-usera@test.com");
    const userB = await createTestUser("lac3-userb", "lac3-userb@test.com");
    const userC = await createTestUser("lac3-userc", "lac3-userc@test.com");

    await ConversationModel.create({
      participants: [new Types.ObjectId(userA.id), new Types.ObjectId(userB.id)],
    });
    await ConversationModel.create({
      participants: [new Types.ObjectId(userA.id), new Types.ObjectId(userC.id)],
    });
    await ConversationModel.create({
      participants: [new Types.ObjectId(userB.id), new Types.ObjectId(userC.id)],
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/admin/chats?page=1&limit=2", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.length).toBe(2);
    expect(data.pagination.total).toBe(3);
    expect(data.pagination.totalPages).toBe(2);
    expect(data.pagination.limit).toBe(2);
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("lac4-customer", "lac4-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/admin/chats", {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});
