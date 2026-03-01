import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { conversationRoutes } from "../../routes/v1/conversations";
import {
  createFreshTestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { ConversationModel } from "../../models/Conversation";
import { Types } from "mongoose";

function createConversationTestApp() {
  return new Elysia().use(conversationRoutes);
}

type ConversationTestApp = ReturnType<typeof createConversationTestApp>;

describe("List Conversations Controller", () => {
  let app: ConversationTestApp;

  beforeAll(async () => {
    await createFreshTestApp();
    app = createConversationTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  describe("GET /api/v1/conversations", () => {
    it("should return empty list when user has no conversations", async () => {
      const user = await createTestUser("lc-solo", "lc-solo@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/conversations", {
          method: "GET",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.conversations).toEqual([]);
    });

    it("should return conversations the user is a participant in", async () => {
      const userA = await createTestUser("lc-usera", "lc-usera@test.com");
      const userB = await createTestUser("lc-userb", "lc-userb@test.com");

      await ConversationModel.create({
        participants: [
          new Types.ObjectId(userA.id),
          new Types.ObjectId(userB.id),
        ],
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/conversations", {
          method: "GET",
          headers: authHeader(userA.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.conversations).toHaveLength(1);
    });

    it("should not return conversations the user is not part of", async () => {
      const userA = await createTestUser("lc-a2", "lc-a2@test.com");
      const userB = await createTestUser("lc-b2", "lc-b2@test.com");
      const userC = await createTestUser("lc-c2", "lc-c2@test.com");

      // Conversation between A and B only
      await ConversationModel.create({
        participants: [
          new Types.ObjectId(userA.id),
          new Types.ObjectId(userB.id),
        ],
      });

      // C should see no conversations
      const response = await app.handle(
        new Request("http://localhost/api/v1/conversations", {
          method: "GET",
          headers: authHeader(userC.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.conversations).toHaveLength(0);
    });

    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/conversations", {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
