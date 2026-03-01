import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  authHeader,
  createFreshTestApp,
  createTestUser,
  type TestApp,
  wipeTestDatabase,
} from "../../../test/helpers";
import { UserModel } from "../../models/User";
import { UserRole } from "../../config/roles";

let app: TestApp;

beforeAll(async () => {
  app = await createFreshTestApp();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

describe("Search Experts Controller", () => {
  describe("GET /api/v1/search/experts", () => {
    it("should return experts with status=active for authenticated user", async () => {
      const customer = await createTestUser(
        "searcher",
        "searcher@test.com",
        UserRole.CUSTOMER
      );

      // Create active expert
      await UserModel.create({
        username: "expert1",
        email: "expert1@test.com",
        password: "hash",
        role: UserRole.EXPERT,
        isActive: true,
        status: "active",
      });

      // Create blocked expert (should not appear)
      await UserModel.create({
        username: "blockedexpert",
        email: "blockedexpert@test.com",
        password: "hash",
        role: UserRole.EXPERT,
        isActive: true,
        status: "blocked",
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/search/experts", {
          method: "GET",
          headers: authHeader(customer.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("experts");
      expect(data).toHaveProperty("pagination");

      const usernames = data.experts.map((e: { username: string }) => e.username);
      expect(usernames).toContain("expert1");
      expect(usernames).not.toContain("blockedexpert");
    });

    it("should filter experts by name (partial username match)", async () => {
      const customer = await createTestUser(
        "name-searcher",
        "name-searcher@test.com",
        UserRole.CUSTOMER
      );

      await UserModel.create([
        {
          username: "johnexpert",
          email: "john@test.com",
          password: "hash",
          role: UserRole.EXPERT,
          isActive: true,
          status: "active",
        },
        {
          username: "janeexpert",
          email: "jane@test.com",
          password: "hash",
          role: UserRole.EXPERT,
          isActive: true,
          status: "active",
        },
      ]);

      const response = await app.handle(
        new Request("http://localhost/api/v1/search/experts?name=john", {
          method: "GET",
          headers: authHeader(customer.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      const usernames = data.experts.map((e: { username: string }) => e.username);
      expect(usernames).toContain("johnexpert");
      expect(usernames).not.toContain("janeexpert");
    });

    it("should support pagination", async () => {
      const customer = await createTestUser(
        "paginator",
        "paginator@test.com",
        UserRole.CUSTOMER
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/search/experts?page=1&limit=5", {
          method: "GET",
          headers: authHeader(customer.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(5);
    });

    it("should reject unauthenticated request", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/search/experts", {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should not return customers or admins in results", async () => {
      const customer = await createTestUser(
        "expert-filter-searcher",
        "expert-filter@test.com",
        UserRole.CUSTOMER
      );

      await createTestUser("admin-user", "admin-user@test.com", UserRole.ADMIN);

      const response = await app.handle(
        new Request("http://localhost/api/v1/search/experts", {
          method: "GET",
          headers: authHeader(customer.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      const roles = data.experts.map((e: { role: string }) => e.role);
      expect(roles.every((r: string) => r === UserRole.EXPERT)).toBe(true);
    });
  });
});
