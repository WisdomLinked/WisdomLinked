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
import { MessageModel } from "../../models/Message";
import { Types } from "mongoose";

function createConversationTestApp() {
  return new Elysia().use(conversationRoutes);
}

type ConversationTestApp = ReturnType<typeof createConversationTestApp>;

describe("Get Messages Controller", () => {
  let app: ConversationTestApp;

  beforeAll(async () => {
    await createFreshTestApp();
    app = createConversationTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  describe("GET /api/v1/conversations/:conversationId/messages", () => {
    it("should return empty messages list for new conversation", async () => {
      const userA = await createTestUser("gm-usera", "gm-usera@test.com");
      const userB = await createTestUser("gm-userb", "gm-userb@test.com");

      const conv = await ConversationModel.create({
        participants: [
          new Types.ObjectId(userA.id),
          new Types.ObjectId(userB.id),
        ],
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/conversations/${conv._id.toString()}/messages`,
          {
            method: "GET",
            headers: authHeader(userA.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.messages).toEqual([]);
      expect(data.total).toBe(0);
      expect(data.page).toBe(1);
      expect(data.totalPages).toBe(0);
    });

    it("should return messages with pagination metadata", async () => {
      const userA = await createTestUser("gm2-usera", "gm2-usera@test.com");
      const userB = await createTestUser("gm2-userb", "gm2-userb@test.com");

      const conv = await ConversationModel.create({
        participants: [
          new Types.ObjectId(userA.id),
          new Types.ObjectId(userB.id),
        ],
      });

      // Create 3 messages
      const convId = conv._id;
      const authorId = new Types.ObjectId(userA.id);
      await MessageModel.create([
        { author: authorId, content: "Msg 1", type: "text", conversationId: convId },
        { author: authorId, content: "Msg 2", type: "text", conversationId: convId },
        { author: authorId, content: "Msg 3", type: "text", conversationId: convId },
      ]);

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/conversations/${conv._id.toString()}/messages`,
          {
            method: "GET",
            headers: authHeader(userA.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.messages).toHaveLength(3);
      expect(data.total).toBe(3);
      expect(data.page).toBe(1);
      expect(data.totalPages).toBe(1);
    });

    it("should paginate messages correctly", async () => {
      const userA = await createTestUser("gm3-usera", "gm3-usera@test.com");
      const userB = await createTestUser("gm3-userb", "gm3-userb@test.com");

      const conv = await ConversationModel.create({
        participants: [
          new Types.ObjectId(userA.id),
          new Types.ObjectId(userB.id),
        ],
      });

      // Create 5 messages
      const convId = conv._id;
      const authorId = new Types.ObjectId(userA.id);
      const msgs = Array.from({ length: 5 }, (_, i) => ({
        author: authorId,
        content: `Message ${i + 1}`,
        type: "text" as const,
        conversationId: convId,
      }));
      await MessageModel.create(msgs);

      // Fetch page 2 with limit 2
      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/conversations/${conv._id.toString()}/messages?page=2&limit=2`,
          {
            method: "GET",
            headers: authHeader(userA.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.messages).toHaveLength(2);
      expect(data.total).toBe(5);
      expect(data.page).toBe(2);
      expect(data.totalPages).toBe(3);
    });

    it("should reject non-participant access", async () => {
      const userA = await createTestUser("gm4-usera", "gm4-usera@test.com");
      const userB = await createTestUser("gm4-userb", "gm4-userb@test.com");
      const userC = await createTestUser("gm4-userc", "gm4-userc@test.com");

      const conv = await ConversationModel.create({
        participants: [
          new Types.ObjectId(userA.id),
          new Types.ObjectId(userB.id),
        ],
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/conversations/${conv._id.toString()}/messages`,
          {
            method: "GET",
            headers: authHeader(userC.token),
          }
        )
      );

      expect(response.status).toBe(403);
    });

    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/conversations/000000000000000000000001/messages",
          { method: "GET" }
        )
      );

      expect(response.status).toBe(401);
    });
  });
});
