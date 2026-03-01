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
import { MessageModel } from "../../models/Message";

describe("Get Admin Conversation Messages Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should return paginated messages for a conversation as admin", async () => {
    const admin = await createTestUser("gacm-admin", "gacm-admin@test.com", UserRole.ADMIN);
    const userA = await createTestUser("gacm-usera", "gacm-usera@test.com");
    const userB = await createTestUser("gacm-userb", "gacm-userb@test.com");

    const conv = await ConversationModel.create({
      participants: [new Types.ObjectId(userA.id), new Types.ObjectId(userB.id)],
    });
    await MessageModel.create({
      author: new Types.ObjectId(userA.id),
      content: "Hello admin view",
      type: "text",
      conversationId: conv._id,
    });

    const response = await app.handle(
      new Request(`http://localhost/api/v1/admin/chats/${conv._id.toString()}/messages`, {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBe(1);
    expect(data.data[0].content).toBe("Hello admin view");
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(1);
  });

  it("should return 404 for non-existent conversation", async () => {
    const admin = await createTestUser("gacm2-admin", "gacm2-admin@test.com", UserRole.ADMIN);
    const nonExistentId = new Types.ObjectId().toString();

    const response = await app.handle(
      new Request(`http://localhost/api/v1/admin/chats/${nonExistentId}/messages`, {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should return 400 for invalid conversation ID", async () => {
    const admin = await createTestUser("gacm3-admin", "gacm3-admin@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/admin/chats/not-a-valid-id/messages", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should return messages sorted by createdAt asc", async () => {
    const admin = await createTestUser("gacm4-admin", "gacm4-admin@test.com", UserRole.ADMIN);
    const userA = await createTestUser("gacm4-usera", "gacm4-usera@test.com");
    const userB = await createTestUser("gacm4-userb", "gacm4-userb@test.com");

    const conv = await ConversationModel.create({
      participants: [new Types.ObjectId(userA.id), new Types.ObjectId(userB.id)],
    });

    await MessageModel.create({
      author: new Types.ObjectId(userA.id),
      content: "First message",
      type: "text",
      conversationId: conv._id,
    });
    await MessageModel.create({
      author: new Types.ObjectId(userB.id),
      content: "Second message",
      type: "text",
      conversationId: conv._id,
    });

    const response = await app.handle(
      new Request(`http://localhost/api/v1/admin/chats/${conv._id.toString()}/messages`, {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.length).toBe(2);
    // Messages sorted by createdAt ascending — first message should come first
    expect(data.data[0].content).toBe("First message");
    expect(data.data[1].content).toBe("Second message");
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("gacm5-customer", "gacm5-customer@test.com", UserRole.CUSTOMER);
    const fakeId = new Types.ObjectId().toString();

    const response = await app.handle(
      new Request(`http://localhost/api/v1/admin/chats/${fakeId}/messages`, {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});
