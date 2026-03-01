import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { friendRoutes } from "../../routes/v1/friends";
import {
  createFreshTestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { FriendInvitationModel } from "../../models/FriendInvitation";
import { Types } from "mongoose";

function createFriendTestApp() {
  return new Elysia().use(friendRoutes);
}

type FriendTestApp = ReturnType<typeof createFriendTestApp>;

describe("List Invitations Controller", () => {
  let app: FriendTestApp;

  beforeAll(async () => {
    await createFreshTestApp();
    app = createFriendTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  describe("GET /api/v1/friends/invitations", () => {
    it("should return all pending invitations by default (type=all)", async () => {
      const sender = await createTestUser("li-sender", "li-sender@test.com");
      const receiver = await createTestUser("li-receiver", "li-receiver@test.com");

      await FriendInvitationModel.create({
        senderId: new Types.ObjectId(sender.id),
        receiverId: new Types.ObjectId(receiver.id),
        status: "pending",
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/friends/invitations", {
          method: "GET",
          headers: authHeader(sender.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invitations).toHaveLength(1);
    });

    it("should return only sent invitations when type=sent", async () => {
      const sender = await createTestUser("li2-sender", "li2-sender@test.com");
      const receiver = await createTestUser("li2-receiver", "li2-receiver@test.com");

      await FriendInvitationModel.create({
        senderId: new Types.ObjectId(sender.id),
        receiverId: new Types.ObjectId(receiver.id),
        status: "pending",
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/friends/invitations?type=sent", {
          method: "GET",
          headers: authHeader(sender.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invitations).toHaveLength(1);

      // Receiver querying sent invitations should get zero
      const receiverResponse = await app.handle(
        new Request("http://localhost/api/v1/friends/invitations?type=sent", {
          method: "GET",
          headers: authHeader(receiver.token),
        })
      );
      const receiverData = await receiverResponse.json();
      expect(receiverData.invitations).toHaveLength(0);
    });

    it("should return only received invitations when type=received", async () => {
      const sender = await createTestUser("li3-sender", "li3-sender@test.com");
      const receiver = await createTestUser("li3-receiver", "li3-receiver@test.com");

      await FriendInvitationModel.create({
        senderId: new Types.ObjectId(sender.id),
        receiverId: new Types.ObjectId(receiver.id),
        status: "pending",
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/friends/invitations?type=received", {
          method: "GET",
          headers: authHeader(receiver.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invitations).toHaveLength(1);
    });

    it("should exclude non-pending invitations", async () => {
      const sender = await createTestUser("li4-sender", "li4-sender@test.com");
      const receiver = await createTestUser("li4-receiver", "li4-receiver@test.com");

      await FriendInvitationModel.create({
        senderId: new Types.ObjectId(sender.id),
        receiverId: new Types.ObjectId(receiver.id),
        status: "accepted",
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/friends/invitations", {
          method: "GET",
          headers: authHeader(sender.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invitations).toHaveLength(0);
    });

    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/friends/invitations", {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
