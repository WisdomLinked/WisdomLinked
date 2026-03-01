import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  authHeader,
  createFreshTestApp,
  createTestUser,
  type TestApp,
  wipeTestDatabase,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

let app: TestApp;

beforeAll(async () => {
  app = await createFreshTestApp();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

describe("Get Profile Controller", () => {
  describe("GET /api/v1/profile", () => {
    it("should return full profile for authenticated user", async () => {
      const user = await createTestUser("profile-user", "profile@test.com", UserRole.CUSTOMER);

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile", {
          method: "GET",
          headers: authHeader(user.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user).toHaveProperty("username", "profile-user");
      expect(data.user).toHaveProperty("email", "profile@test.com");
      // Password must not be returned
      expect(data.user).not.toHaveProperty("password");
    });

    it("should return profile for expert user", async () => {
      const expert = await createTestUser("expert-profile", "expert@test.com", UserRole.EXPERT);

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile", {
          method: "GET",
          headers: authHeader(expert.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.role).toBe(UserRole.EXPERT);
    });

    it("should reject unauthenticated request", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/profile", {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject request with invalid token", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/profile", {
          method: "GET",
          headers: authHeader("invalid.token"),
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
