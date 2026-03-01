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

describe("Upload Chat File Controller", () => {
  let app: ConversationTestApp;

  beforeAll(async () => {
    await createFreshTestApp();
    app = createConversationTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  describe("POST /api/v1/conversations/:conversationId/upload", () => {
    it("should reject unauthenticated request", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["hello"], { type: "text/plain" }),
        "test.txt"
      );

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/conversations/000000000000000000000001/upload",
          {
            method: "POST",
            body: formData,
          }
        )
      );

      expect(response.status).toBe(401);
    });

    it("should reject request with missing file", async () => {
      const userA = await createTestUser("ucf-usera", "ucf-usera@test.com");
      const userB = await createTestUser("ucf-userb", "ucf-userb@test.com");

      const conv = await ConversationModel.create({
        participants: [
          new Types.ObjectId(userA.id),
          new Types.ObjectId(userB.id),
        ],
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/conversations/${conv._id.toString()}/upload`,
          {
            method: "POST",
            headers: authHeader(userA.token),
            body: new FormData(),
          }
        )
      );

      expect(response.status).toBe(422);
    });

    it("should reject non-participant user", async () => {
      const userA = await createTestUser("ucf2-usera", "ucf2-usera@test.com");
      const userB = await createTestUser("ucf2-userb", "ucf2-userb@test.com");
      const userC = await createTestUser("ucf2-userc", "ucf2-userc@test.com");

      const conv = await ConversationModel.create({
        participants: [
          new Types.ObjectId(userA.id),
          new Types.ObjectId(userB.id),
        ],
      });

      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["hello"], { type: "text/plain" }),
        "test.txt"
      );

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/conversations/${conv._id.toString()}/upload`,
          {
            method: "POST",
            headers: authHeader(userC.token),
            body: formData,
          }
        )
      );

      expect(response.status).toBe(403);
    });

    it("should reject invalid conversation ID format", async () => {
      const userA = await createTestUser("ucf3-usera", "ucf3-usera@test.com");

      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["hello"], { type: "text/plain" }),
        "test.txt"
      );

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/conversations/not-a-valid-id/upload",
          {
            method: "POST",
            headers: authHeader(userA.token),
            body: formData,
          }
        )
      );

      expect(response.status).toBe(400);
    });

    it("should return 404 for non-existent conversation", async () => {
      const userA = await createTestUser("ucf4-usera", "ucf4-usera@test.com");

      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["hello"], { type: "text/plain" }),
        "test.txt"
      );

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/conversations/000000000000000000000099/upload",
          {
            method: "POST",
            headers: authHeader(userA.token),
            body: formData,
          }
        )
      );

      expect(response.status).toBe(404);
    });
  });
});
