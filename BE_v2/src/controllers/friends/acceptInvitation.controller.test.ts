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
import { UserModel } from "../../models/User";
import { Types } from "mongoose";

function createFriendTestApp() {
  return new Elysia().use(friendRoutes);
}

type FriendTestApp = ReturnType<typeof createFriendTestApp>;

describe("Accept Invitation Controller", () => {
  let app: FriendTestApp;

  beforeAll(async () => {
    await createFreshTestApp();
    app = createFriendTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  describe("PUT /api/v1/friends/:invitationId/accept", () => {
    it("should accept a pending invitation and add friends", async () => {
      const sender = await createTestUser("acc-sender", "acc-sender@test.com");
      const receiver = await createTestUser("acc-receiver", "acc-receiver@test.com");

      const invitation = await FriendInvitationModel.create({
        senderId: new Types.ObjectId(sender.id),
        receiverId: new Types.ObjectId(receiver.id),
        status: "pending",
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/friends/${invitation._id.toString()}/accept`,
          {
            method: "PUT",
            headers: jsonHeaders(receiver.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Friend request accepted");
      expect(data.conversationId).toBeDefined();

      // Verify both users now have each other as friends
      const updatedSender = await UserModel.findById(sender.id).lean().exec();
      const updatedReceiver = await UserModel.findById(receiver.id).lean().exec();
      expect(updatedSender?.friends.some((id) => id.toString() === receiver.id)).toBe(true);
      expect(updatedReceiver?.friends.some((id) => id.toString() === sender.id)).toBe(true);
    });

    it("should reject accept without authentication", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/friends/000000000000000000000001/accept",
          { method: "PUT" }
        )
      );

      expect(response.status).toBe(401);
    });

    it("should reject accept by non-receiver", async () => {
      const sender = await createTestUser("acc2-sender", "acc2-sender@test.com");
      const receiver = await createTestUser("acc2-receiver", "acc2-receiver@test.com");

      const invitation = await FriendInvitationModel.create({
        senderId: new Types.ObjectId(sender.id),
        receiverId: new Types.ObjectId(receiver.id),
        status: "pending",
      });

      // Sender tries to accept their own invitation
      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/friends/${invitation._id.toString()}/accept`,
          {
            method: "PUT",
            headers: jsonHeaders(sender.token),
          }
        )
      );

      expect(response.status).toBe(403);
    });

    it("should reject accept for already accepted invitation", async () => {
      const sender = await createTestUser("acc3-sender", "acc3-sender@test.com");
      const receiver = await createTestUser("acc3-receiver", "acc3-receiver@test.com");

      const invitation = await FriendInvitationModel.create({
        senderId: new Types.ObjectId(sender.id),
        receiverId: new Types.ObjectId(receiver.id),
        status: "accepted",
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/friends/${invitation._id.toString()}/accept`,
          {
            method: "PUT",
            headers: jsonHeaders(receiver.token),
          }
        )
      );

      expect(response.status).toBe(409);
    });

    it("should return 404 for non-existent invitation", async () => {
      const receiver = await createTestUser("acc4-receiver", "acc4-receiver@test.com");

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/friends/000000000000000000000001/accept",
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
