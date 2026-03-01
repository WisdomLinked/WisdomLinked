import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Get All Users Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should return all users for admin", async () => {
    const admin = await createTestUser("gau-admin", "gau-admin@test.com", UserRole.ADMIN);
    await createTestUser("gau-user1", "gau-user1@test.com");
    await createTestUser("gau-user2", "gau-user2@test.com");

    const response = await app.handle(
      new Request("http://localhost/api/v1/users", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBeGreaterThanOrEqual(2);
    // Each user record should include expected fields
    expect(data.users[0].id).toBeDefined();
    expect(data.users[0].username).toBeDefined();
    expect(data.users[0].email).toBeDefined();
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("gau-customer", "gau-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/users", {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });

  it("should reject unauthenticated requests", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/users", {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
  });
});

