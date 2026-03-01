import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Search Users Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should search and list users for admin", async () => {
    const admin = await createTestUser("su-admin", "su-admin@test.com", UserRole.ADMIN);
    await createTestUser("su-user1", "su-user1@test.com");
    await createTestUser("su-user2", "su-user2@test.com");

    const response = await app.handle(
      new Request("http://localhost/api/v1/user-management/users", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBeGreaterThanOrEqual(3);
  });

  it("should filter users by search query", async () => {
    const admin = await createTestUser("su-admin2", "su-admin2@test.com", UserRole.ADMIN);
    await createTestUser("uniqueusername", "unique@test.com");
    await createTestUser("anotheruser", "another@test.com");

    const response = await app.handle(
      new Request("http://localhost/api/v1/user-management/users?search=uniqueusername", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.users.length).toBe(1);
    expect(data.users[0].username).toBe("uniqueusername");
  });

  it("should filter by role", async () => {
    const admin = await createTestUser("su-admin3", "su-admin3@test.com", UserRole.ADMIN);
    await createTestUser("su-expert", "su-expert@test.com", UserRole.EXPERT);
    await createTestUser("su-customer", "su-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/user-management/users?role=expert", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.users.length).toBeGreaterThan(0);
    expect(data.users.every((u: { role: string }) => u.role === "expert")).toBe(true);
  });

  it("should paginate results", async () => {
    const admin = await createTestUser("su-admin4", "su-admin4@test.com", UserRole.ADMIN);
    for (let i = 0; i < 5; i++) {
      await createTestUser(`su-paged${i}`, `su-paged${i}@test.com`);
    }

    const response = await app.handle(
      new Request("http://localhost/api/v1/user-management/users?page=1&limit=2", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.users.length).toBeLessThanOrEqual(2);
    expect(data.pagination.limit).toBe(2);
    expect(data.pagination.page).toBe(1);
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("su-customer2", "su-customer2@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/user-management/users", {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});

