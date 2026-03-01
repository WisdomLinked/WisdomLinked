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

describe("List ChatBot Q&A Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should list chatbot Q&A entries for admin", async () => {
    const admin = await createTestUser("lc-admin", "lc-admin@test.com", UserRole.ADMIN);
    await ChatBotQAModel.create([
      { question: "Q1?", answer: "A1.", isActive: true },
      { question: "Q2?", answer: "A2.", isActive: false },
    ]);

    const response = await app.handle(
      new Request("http://localhost/api/v1/chatbot", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(2);
    expect(data.pagination.page).toBe(1);
  });

  it("should filter by search query", async () => {
    const admin = await createTestUser("lc-admin2", "lc-admin2@test.com", UserRole.ADMIN);
    await ChatBotQAModel.create([
      {
        question: "How do I reset my password?",
        answer: "Click forgot password on the login page.",
        isActive: true,
      },
      {
        question: "How do I contact support?",
        answer: "Email support@example.com",
        isActive: true,
      },
    ]);

    const response = await app.handle(
      new Request("http://localhost/api/v1/chatbot?search=reset", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].question).toBe("How do I reset my password?");
  });

  it("should filter by isActive status", async () => {
    const admin = await createTestUser("lc-admin3", "lc-admin3@test.com", UserRole.ADMIN);
    await ChatBotQAModel.create([
      { question: "Active Q?", answer: "Active A.", isActive: true },
      { question: "Inactive Q?", answer: "Inactive A.", isActive: false },
    ]);

    const response = await app.handle(
      new Request("http://localhost/api/v1/chatbot?isActive=true", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].question).toBe("Active Q?");
    expect(data.data[0].isActive).toBe(true);
  });

  it("should paginate results", async () => {
    const admin = await createTestUser("lc-admin4", "lc-admin4@test.com", UserRole.ADMIN);
    await ChatBotQAModel.create([
      { question: "Q1?", answer: "A1.", isActive: true },
      { question: "Q2?", answer: "A2.", isActive: true },
      { question: "Q3?", answer: "A3.", isActive: true },
    ]);

    const response = await app.handle(
      new Request("http://localhost/api/v1/chatbot?page=1&limit=2", {
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
    const customer = await createTestUser("lc-customer", "lc-customer@test.com");

    const response = await app.handle(
      new Request("http://localhost/api/v1/chatbot", {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});
