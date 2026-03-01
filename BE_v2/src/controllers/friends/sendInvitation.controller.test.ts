import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { friendRoutes } from "../../routes/v1/friends";
import {
  createFreshTestApp,
  wipeTestDatabase,
  createTestUser,
  jsonHeaders,
} from "../../../test/helpers";

function createFriendTestApp() {
  return new Elysia().use(friendRoutes);
}

type FriendTestApp = ReturnType<typeof createFriendTestApp>;

describe("Send Invitation Controller", () => {
  let app: FriendTestApp;

  beforeAll(async () => {
    await createFreshTestApp(); // sets up DB connection + wipe
    app = createFriendTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  describe("POST /api/v1/friends", () => {
    it("should send a friend invitation successfully", async () => {
      const sender = await createTestUser("sender1", "sender1@test.com");
      const receiver = await createTestUser("receiver1", "receiver1@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/friends", {
          method: "POST",
          headers: jsonHeaders(sender.token),
          body: JSON.stringify({ receiverId: receiver.id }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invitation).toBeDefined();
      expect(data.invitation.senderId).toBe(sender.id);
      expect(data.invitation.receiverId).toBe(receiver.id);
      expect(data.invitation.status).toBe("pending");
    });

    it("should reject sending invitation without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiverId: "someid" }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject sending invitation to yourself", async () => {
      const sender = await createTestUser("self-sender", "self-sender@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/friends", {
          method: "POST",
          headers: jsonHeaders(sender.token),
          body: JSON.stringify({ receiverId: sender.id }),
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should reject sending invitation to non-existent user", async () => {
      const sender = await createTestUser("sender-notfound", "sender-notfound@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/friends", {
          method: "POST",
          headers: jsonHeaders(sender.token),
          body: JSON.stringify({ receiverId: "000000000000000000000001" }),
        })
      );

      expect(response.status).toBe(404);
    });

    it("should reject duplicate pending invitation", async () => {
      const sender = await createTestUser("dup-sender", "dup-sender@test.com");
      const receiver = await createTestUser("dup-receiver", "dup-receiver@test.com");

      // First invitation
      await app.handle(
        new Request("http://localhost/api/v1/friends", {
          method: "POST",
          headers: jsonHeaders(sender.token),
          body: JSON.stringify({ receiverId: receiver.id }),
        })
      );

      // Duplicate
      const response = await app.handle(
        new Request("http://localhost/api/v1/friends", {
          method: "POST",
          headers: jsonHeaders(sender.token),
          body: JSON.stringify({ receiverId: receiver.id }),
        })
      );

      expect(response.status).toBe(409);
    });

    it("should reject invitation with invalid receiverId", async () => {
      const sender = await createTestUser("inv-sender", "inv-sender@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/friends", {
          method: "POST",
          headers: jsonHeaders(sender.token),
          body: JSON.stringify({ receiverId: "not-a-valid-id" }),
        })
      );

      expect(response.status).toBe(400);
    });
  });
});
