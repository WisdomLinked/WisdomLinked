import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
  jsonHeaders,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";
import { ChatBotQAModel } from "../../models/ChatBotQA";
import { Types } from "mongoose";

describe("Update ChatBot Q&A Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should update a chatbot Q&A entry as admin", async () => {
    const admin = await createTestUser("uc-admin", "uc-admin@test.com", UserRole.ADMIN);
    const qa = await ChatBotQAModel.create({
      question: "Original question?",
      answer: "Original answer.",
      isActive: true,
    });

    const response = await app.handle(
      new Request(`http://localhost/api/v1/chatbot/${qa._id.toString()}`, {
        method: "PUT",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({
          question: "Updated question?",
          isActive: false,
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.question).toBe("Updated question?");
    expect(data.data.answer).toBe("Original answer.");
    expect(data.data.isActive).toBe(false);
    expect(data.data.id).toBe(qa._id.toString());
  });

  it("should return 404 for non-existent entry", async () => {
    const admin = await createTestUser("uc-admin2", "uc-admin2@test.com", UserRole.ADMIN);
    const nonExistentId = new Types.ObjectId().toString();

    const response = await app.handle(
      new Request(`http://localhost/api/v1/chatbot/${nonExistentId}`, {
        method: "PUT",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({ question: "Updated question?" }),
      })
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Chatbot Q&A not found");
  });

  it("should return 400 for invalid ID", async () => {
    const admin = await createTestUser("uc-admin3", "uc-admin3@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/chatbot/not-a-valid-id", {
        method: "PUT",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({ question: "Updated question?" }),
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid ID");
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("uc-customer", "uc-customer@test.com");
    const fakeId = new Types.ObjectId().toString();

    const response = await app.handle(
      new Request(`http://localhost/api/v1/chatbot/${fakeId}`, {
        method: "PUT",
        headers: jsonHeaders(customer.token),
        body: JSON.stringify({ question: "Updated question?" }),
      })
    );

    expect(response.status).toBe(403);
  });
});
