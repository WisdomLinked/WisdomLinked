import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { conversationRoutes } from "../../routes/v1/conversations";
import {
  createFreshTestApp,
  wipeTestDatabase,
  createTestUser,
  jsonHeaders,
} from "../../../test/helpers";
import { ConversationModel } from "../../models/Conversation";
import { Types } from "mongoose";

function createConversationTestApp() {
  return new Elysia().use(conversationRoutes);
}

type ConversationTestApp = ReturnType<typeof createConversationTestApp>;

describe("Send Message Controller", () => {
  let app: ConversationTestApp;

  beforeAll(async () => {
    await createFreshTestApp();
    app = createConversationTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  describe("POST /api/v1/conversations/:conversationId/messages", () => {
    it("should send a text message successfully", async () => {
      const userA = await createTestUser("sm-usera", "sm-usera@test.com");
      const userB = await createTestUser("sm-userb", "sm-userb@test.com");

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
            method: "POST",
            headers: jsonHeaders(userA.token),
            body: JSON.stringify({ content: "Hello there!", type: "text" }),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message.content).toBe("Hello there!");
      expect(data.message.type).toBe("text");
      expect(data.message.author).toBe(userA.id);
    });

    it("should update conversation lastMessage after sending", async () => {
      const userA = await createTestUser("sm2-usera", "sm2-usera@test.com");
      const userB = await createTestUser("sm2-userb", "sm2-userb@test.com");

      const conv = await ConversationModel.create({
        participants: [
          new Types.ObjectId(userA.id),
          new Types.ObjectId(userB.id),
        ],
      });

      await app.handle(
        new Request(
          `http://localhost/api/v1/conversations/${conv._id.toString()}/messages`,
          {
            method: "POST",
            headers: jsonHeaders(userA.token),
            body: JSON.stringify({ content: "Update lastMessage" }),
          }
        )
      );

      const updatedConv = await ConversationModel.findById(conv._id).lean().exec();
      expect(updatedConv?.lastMessage).toBeDefined();
    });

    it("should reject sending message by non-participant", async () => {
      const userA = await createTestUser("sm3-usera", "sm3-usera@test.com");
      const userB = await createTestUser("sm3-userb", "sm3-userb@test.com");
      const userC = await createTestUser("sm3-userc", "sm3-userc@test.com");

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
            method: "POST",
            headers: jsonHeaders(userC.token),
            body: JSON.stringify({ content: "Sneaky message" }),
          }
        )
      );

      expect(response.status).toBe(403);
    });

    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/conversations/000000000000000000000001/messages",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "No auth" }),
          }
        )
      );

      expect(response.status).toBe(401);
    });

    it("should reject message with empty content", async () => {
      const userA = await createTestUser("sm4-usera", "sm4-usera@test.com");
      const userB = await createTestUser("sm4-userb", "sm4-userb@test.com");

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
            method: "POST",
            headers: jsonHeaders(userA.token),
            body: JSON.stringify({ content: "" }),
          }
        )
      );

      // Empty content fails schema validation
      expect(response.status).toBe(422);
    });
  });
});
