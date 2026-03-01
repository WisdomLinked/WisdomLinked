import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { friendRoutes } from "../../routes/v1/friends";
import {
  createFreshTestApp,
  wipeTestDatabase,
  createTestUser,
  jsonHeaders,
} from "../../../test/helpers";
import { FriendInvitationModel } from "../../models/FriendInvitation";
import { Types } from "mongoose";

function createFriendTestApp() {
  return new Elysia().use(friendRoutes);
}

type FriendTestApp = ReturnType<typeof createFriendTestApp>;

describe("Reject Invitation Controller", () => {
  let app: FriendTestApp;

  beforeAll(async () => {
    await createFreshTestApp();
    app = createFriendTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  describe("PUT /api/v1/friends/:invitationId/reject", () => {
    it("should reject a pending invitation", async () => {
      const sender = await createTestUser("rej-sender", "rej-sender@test.com");
      const receiver = await createTestUser("rej-receiver", "rej-receiver@test.com");

      const invitation = await FriendInvitationModel.create({
        senderId: new Types.ObjectId(sender.id),
        receiverId: new Types.ObjectId(receiver.id),
        status: "pending",
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/friends/${invitation._id.toString()}/reject`,
          {
            method: "PUT",
            headers: jsonHeaders(receiver.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invitation.status).toBe("rejected");
    });

    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/friends/000000000000000000000001/reject",
          { method: "PUT" }
        )
      );

      expect(response.status).toBe(401);
    });

    it("should reject when caller is not the receiver", async () => {
      const sender = await createTestUser("rej2-sender", "rej2-sender@test.com");
      const receiver = await createTestUser("rej2-receiver", "rej2-receiver@test.com");

      const invitation = await FriendInvitationModel.create({
        senderId: new Types.ObjectId(sender.id),
        receiverId: new Types.ObjectId(receiver.id),
        status: "pending",
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/friends/${invitation._id.toString()}/reject`,
          {
            method: "PUT",
            headers: jsonHeaders(sender.token),
          }
        )
      );

      expect(response.status).toBe(403);
    });

    it("should reject when invitation is not pending", async () => {
      const sender = await createTestUser("rej3-sender", "rej3-sender@test.com");
      const receiver = await createTestUser("rej3-receiver", "rej3-receiver@test.com");

      const invitation = await FriendInvitationModel.create({
        senderId: new Types.ObjectId(sender.id),
        receiverId: new Types.ObjectId(receiver.id),
        status: "rejected",
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/friends/${invitation._id.toString()}/reject`,
          {
            method: "PUT",
            headers: jsonHeaders(receiver.token),
          }
        )
      );

      expect(response.status).toBe(409);
    });

    it("should return 404 for non-existent invitation", async () => {
      const receiver = await createTestUser("rej4-receiver", "rej4-receiver@test.com");

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/friends/000000000000000000000001/reject",
          {
            method: "PUT",
            headers: jsonHeaders(receiver.token),
          }
        )
      );

      expect(response.status).toBe(404);
    });
  });
});
