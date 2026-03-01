import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";
import { ChatBotQAModel } from "../../models/ChatBotQA";
import { Types } from "mongoose";

describe("Delete ChatBot Q&A Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should delete a chatbot Q&A entry as admin", async () => {
    const admin = await createTestUser("dc-admin", "dc-admin@test.com", UserRole.ADMIN);
    const qa = await ChatBotQAModel.create({
      question: "Test question?",
      answer: "Test answer.",
      isActive: true,
    });

    const response = await app.handle(
      new Request(`http://localhost/api/v1/chatbot/${qa._id.toString()}`, {
        method: "DELETE",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("Chatbot Q&A deleted successfully");
    const deleted = await ChatBotQAModel.findById(qa._id);
    expect(deleted).toBeNull();
  });

  it("should return 404 for non-existent entry", async () => {
    const admin = await createTestUser("dc-admin2", "dc-admin2@test.com", UserRole.ADMIN);
    const nonExistentId = new Types.ObjectId().toString();

    const response = await app.handle(
      new Request(`http://localhost/api/v1/chatbot/${nonExistentId}`, {
        method: "DELETE",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Chatbot Q&A not found");
  });

  it("should return 400 for invalid ID", async () => {
    const admin = await createTestUser("dc-admin3", "dc-admin3@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/chatbot/not-a-valid-id", {
        method: "DELETE",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid ID");
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("dc-customer", "dc-customer@test.com");
    const fakeId = new Types.ObjectId().toString();

    const response = await app.handle(
      new Request(`http://localhost/api/v1/chatbot/${fakeId}`, {
        method: "DELETE",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});
