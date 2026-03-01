import { beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { connectToDatabase } from "../../config/database";
import {
  createTestUser,
  jsonHeaders,
  wipeTestDatabase,
} from "../../../test/helpers";
import { groupChatRoutes } from "../../routes/v1/groupChats";
import { UserRole } from "../../config/roles";

function createGroupChatApp() {
  return new Elysia().use(groupChatRoutes);
}

type GroupChatApp = ReturnType<typeof createGroupChatApp>;

let app: GroupChatApp;
let expertToken: string;
let customerToken: string;

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  app = createGroupChatApp();

  const expert = await createTestUser("expert_gc", "expert_gc@test.com", UserRole.EXPERT);
  expertToken = expert.token;

  const customer = await createTestUser("customer_gc", "customer_gc@test.com", UserRole.CUSTOMER);
  customerToken = customer.token;
});

describe("Create Group Chat Controller", () => {
  describe("POST /api/v1/group-chats", () => {
    it("should allow an expert to create a seminar", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats", {
          method: "POST",
          headers: jsonHeaders(expertToken),
          body: JSON.stringify({
            name: "Expert Seminar",
            description: "A test seminar",
            type: "seminar",
            price: 50,
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("groupChat");
      expect(data.groupChat.type).toBe("seminar");
      expect(data.groupChat.status).toBe("pending");
    });

    it("should allow an expert to create an individual group chat", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats", {
          method: "POST",
          headers: jsonHeaders(expertToken),
          body: JSON.stringify({
            name: "1-on-1 Consultation",
            type: "individual",
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.groupChat.type).toBe("individual");
    });

    it("should allow any authenticated user to create a community group chat", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats", {
          method: "POST",
          headers: jsonHeaders(customerToken),
          body: JSON.stringify({
            name: "Community Chat",
            type: "community",
            isOpenToAll: true,
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.groupChat.type).toBe("community");
      expect(data.groupChat.isOpenToAll).toBe(true);
    });

    it("should reject a customer trying to create a seminar (403)", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats", {
          method: "POST",
          headers: jsonHeaders(customerToken),
          body: JSON.stringify({
            name: "Unauthorized Seminar",
            type: "seminar",
          }),
        })
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("Only experts");
    });

    it("should reject a customer trying to create an individual group chat (403)", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats", {
          method: "POST",
          headers: jsonHeaders(customerToken),
          body: JSON.stringify({
            name: "Unauthorized 1-on-1",
            type: "individual",
          }),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should reject unauthenticated request (401)", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test", type: "community" }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject missing required fields (422)", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats", {
          method: "POST",
          headers: jsonHeaders(expertToken),
          body: JSON.stringify({ description: "Missing name and type" }),
        })
      );

      expect(response.status).toBe(422);
    });

    it("should include creator in participants and link to user's groupChats", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats", {
          method: "POST",
          headers: jsonHeaders(expertToken),
          body: JSON.stringify({
            name: "Participant Check Seminar",
            type: "seminar",
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.groupChat.participants).toHaveLength(1);
      expect(data.groupChat.admin).toBeDefined();
    });
  });
});
