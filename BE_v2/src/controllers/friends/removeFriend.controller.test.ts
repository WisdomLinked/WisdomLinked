import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { friendRoutes } from "../../routes/v1/friends";
import {
  createFreshTestApp,
  wipeTestDatabase,
  createTestUser,
  jsonHeaders,
} from "../../../test/helpers";
import { UserModel } from "../../models/User";
import { Types } from "mongoose";

function createFriendTestApp() {
  return new Elysia().use(friendRoutes);
}

type FriendTestApp = ReturnType<typeof createFriendTestApp>;

describe("Remove Friend Controller", () => {
  let app: FriendTestApp;

  beforeAll(async () => {
    await createFreshTestApp();
    app = createFriendTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  describe("DELETE /api/v1/friends/:friendId", () => {
    it("should remove friend from both users' lists", async () => {
      const userA = await createTestUser("rmfrd-a", "rmfrd-a@test.com");
      const userB = await createTestUser("rmfrd-b", "rmfrd-b@test.com");

      // Manually set up friendship
      await UserModel.updateOne(
        { _id: new Types.ObjectId(userA.id) },
        { $addToSet: { friends: new Types.ObjectId(userB.id) } }
      );
      await UserModel.updateOne(
        { _id: new Types.ObjectId(userB.id) },
        { $addToSet: { friends: new Types.ObjectId(userA.id) } }
      );

      const response = await app.handle(
        new Request(`http://localhost/api/v1/friends/${userB.id}`, {
          method: "DELETE",
          headers: jsonHeaders(userA.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Friend removed");

      // Verify both users no longer have each other as friends
      const updatedA = await UserModel.findById(userA.id).lean().exec();
      const updatedB = await UserModel.findById(userB.id).lean().exec();
      expect(updatedA?.friends.some((id) => id.toString() === userB.id)).toBe(false);
      expect(updatedB?.friends.some((id) => id.toString() === userA.id)).toBe(false);
    });

    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/friends/000000000000000000000001",
          { method: "DELETE" }
        )
      );

      expect(response.status).toBe(401);
    });

    it("should return 404 when target is not in friends list", async () => {
      const userA = await createTestUser("rmfrd2-a", "rmfrd2-a@test.com");
      const userB = await createTestUser("rmfrd2-b", "rmfrd2-b@test.com");

      const response = await app.handle(
        new Request(`http://localhost/api/v1/friends/${userB.id}`, {
          method: "DELETE",
          headers: jsonHeaders(userA.token),
        })
      );

      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid friend ID format", async () => {
      const userA = await createTestUser("rmfrd3-a", "rmfrd3-a@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/friends/not-a-valid-id", {
          method: "DELETE",
          headers: jsonHeaders(userA.token),
        })
      );

      expect(response.status).toBe(400);
    });
  });
});
