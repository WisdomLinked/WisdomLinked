import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  jsonHeaders,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Create ChatBot Q&A Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should create a chatbot Q&A entry as admin", async () => {
    const admin = await createTestUser("cc-admin", "cc-admin@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/chatbot", {
        method: "POST",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({
          question: "What is WisdomLinked?",
          answer: "WisdomLinked is a platform for expert consultations.",
          category: "general",
          isActive: true,
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.question).toBe("What is WisdomLinked?");
    expect(data.data.answer).toBe("WisdomLinked is a platform for expert consultations.");
    expect(data.data.category).toBe("general");
    expect(data.data.isActive).toBe(true);
    expect(data.data.id).toBeDefined();
    expect(data.data.createdAt).toBeDefined();
  });

  it("should reject missing required fields", async () => {
    const admin = await createTestUser("cc-admin2", "cc-admin2@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/chatbot", {
        method: "POST",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({
          question: "What is WisdomLinked?",
          // answer is missing — required field
        }),
      })
    );

    expect(response.status).toBe(422);
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("cc-customer", "cc-customer@test.com");

    const response = await app.handle(
      new Request("http://localhost/api/v1/chatbot", {
        method: "POST",
        headers: jsonHeaders(customer.token),
        body: JSON.stringify({
          question: "What is WisdomLinked?",
          answer: "A platform for expert consultations.",
        }),
      })
    );

    expect(response.status).toBe(403);
  });
});
