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

describe("Search Customers Controller", () => {
  describe("GET /api/v1/search/customers", () => {
    it("should allow admin to search customers", async () => {
      const admin = await createTestUser("admin-search", "admin-search@test.com", UserRole.ADMIN);

      await UserModel.create({
        username: "customer1",
        email: "customer1@test.com",
        password: "hash",
        role: UserRole.CUSTOMER,
        isActive: true,
        status: "active",
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/search/customers", {
          method: "GET",
          headers: authHeader(admin.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("customers");
      expect(data).toHaveProperty("pagination");
      const roles = data.customers.map((c: { role: string }) => c.role);
      expect(roles.every((r: string) => r === UserRole.CUSTOMER)).toBe(true);
    });

    it("should allow expert to search customers", async () => {
      const expert = await createTestUser("expert-search", "expert-search@test.com", UserRole.EXPERT);

      const response = await app.handle(
        new Request("http://localhost/api/v1/search/customers", {
          method: "GET",
          headers: authHeader(expert.token),
        })
      );

      expect(response.status).toBe(200);
    });

    it("should reject customer role from searching customers", async () => {
      const customer = await createTestUser(
        "denied-customer",
        "denied-customer@test.com",
        UserRole.CUSTOMER
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/search/customers", {
          method: "GET",
          headers: authHeader(customer.token),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should filter customers by name", async () => {
      const admin = await createTestUser("admin-filter", "admin-filter@test.com", UserRole.ADMIN);

      await UserModel.create([
        {
          username: "alicecustomer",
          email: "alice@test.com",
          password: "hash",
          role: UserRole.CUSTOMER,
          isActive: true,
          status: "active",
        },
        {
          username: "bobcustomer",
          email: "bob@test.com",
          password: "hash",
          role: UserRole.CUSTOMER,
          isActive: true,
          status: "active",
        },
      ]);

      const response = await app.handle(
        new Request("http://localhost/api/v1/search/customers?name=alice", {
          method: "GET",
          headers: authHeader(admin.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      const usernames = data.customers.map((c: { username: string }) => c.username);
      expect(usernames).toContain("alicecustomer");
      expect(usernames).not.toContain("bobcustomer");
    });

    it("should reject unauthenticated request", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/search/customers", {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should support pagination", async () => {
      const admin = await createTestUser("admin-paginator", "admin-paginator@test.com", UserRole.ADMIN);

      const response = await app.handle(
        new Request("http://localhost/api/v1/search/customers?page=2&limit=10", {
          method: "GET",
          headers: authHeader(admin.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.limit).toBe(10);
    });
  });
});
