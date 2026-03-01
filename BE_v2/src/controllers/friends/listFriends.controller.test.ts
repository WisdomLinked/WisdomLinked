import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { friendRoutes } from "../../routes/v1/friends";
import {
  createFreshTestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserModel } from "../../models/User";
import { Types } from "mongoose";

function createFriendTestApp() {
  return new Elysia().use(friendRoutes);
}

type FriendTestApp = ReturnType<typeof createFriendTestApp>;

describe("List Friends Controller", () => {
  let app: FriendTestApp;

  beforeAll(async () => {
    await createFreshTestApp();
    app = createFriendTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  describe("GET /api/v1/friends", () => {
    it("should return empty friends list for user with no friends", async () => {
      const user = await createTestUser("lf-alone", "lf-alone@test.com");

      const response = await app.handle(
        new Request("http://localhost/api/v1/friends", {
          method: "GET",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.friends).toEqual([]);
    });

    it("should return friends list with populated data", async () => {
      const userA = await createTestUser("lf-usera", "lf-usera@test.com");
      const userB = await createTestUser("lf-userb", "lf-userb@test.com");

      // Manually set up friendship
      await UserModel.updateOne(
        { _id: new Types.ObjectId(userA.id) },
        { $addToSet: { friends: new Types.ObjectId(userB.id) } }
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/friends", {
          method: "GET",
          headers: authHeader(userA.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.friends).toHaveLength(1);
      expect(data.friends[0].id).toBe(userB.id);
      expect(data.friends[0].username).toBe("lf-userb");
    });

    it("should reject without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/friends", {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
