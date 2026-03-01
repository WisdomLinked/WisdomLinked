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

describe("Get Conversation Controller", () => {
  let app: ConversationTestApp;

  beforeAll(async () => {
    await createFreshTestApp();
    app = createConversationTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  describe("GET /api/v1/conversations/:conversationId", () => {
    it("should return conversation for a participant", async () => {
      const userA = await createTestUser("gc-usera", "gc-usera@test.com");
      const userB = await createTestUser("gc-userb", "gc-userb@test.com");

      const conv = await ConversationModel.create({
        participants: [
          new Types.ObjectId(userA.id),
          new Types.ObjectId(userB.id),
        ],
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/conversations/${conv._id.toString()}`,
          {
            method: "GET",
            headers: authHeader(userA.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.conversation.id).toBe(conv._id.toString());
    });

    it("should return 403 for non-participant", async () => {
      const userA = await createTestUser("gc-a2", "gc-a2@test.com");
      const userB = await createTestUser("gc-b2", "gc-b2@test.com");
      const userC = await createTestUser("gc-c2", "gc-c2@test.com");

      const conv = await ConversationModel.create({
        participants: [
          new Types.ObjectId(userA.id),
          new Types.ObjectId(userB.id),
        ],
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/conversations/${conv._id.toString()}`,
          {
            method: "GET",
            headers: authHeader(userC.token),
          }
        )
      );

      expect(response.status).toBe(403);
    });

    it("should return 404 for non-existent conversation", async () => {
      const user = await createTestUser("gc-none", "gc-none@test.com");

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/conversations/000000000000000000000001",
          {
            method: "GET",
            headers: authHeader(user.token),
          }
        )
      );

      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid conversation ID", async () => {
      const user = await createTestUser("gc-bad", "gc-bad@test.com");

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/conversations/not-a-valid-id",
          {
            method: "GET",
            headers: authHeader(user.token),
          }
        )
      );

      expect(response.status).toBe(400);
    });

    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/conversations/000000000000000000000001",
          { method: "GET" }
        )
      );

      expect(response.status).toBe(401);
    });
  });
});
