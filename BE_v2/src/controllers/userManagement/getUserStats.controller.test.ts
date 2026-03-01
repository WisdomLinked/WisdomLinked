import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Get User Stats Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should return user statistics for admin", async () => {
    const admin = await createTestUser("gus-admin", "gus-admin@test.com", UserRole.ADMIN);
    await createTestUser("gus-user1", "gus-user1@test.com");
    await createTestUser("gus-user2", "gus-user2@test.com");

    const response = await app.handle(
      new Request("http://localhost/api/v1/user-management/stats", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(typeof data.total).toBe("number");
    expect(typeof data.active).toBe("number");
    expect(typeof data.inactive).toBe("number");
    expect(typeof data.admins).toBe("number");
    expect(data.byAuthMethod).toBeDefined();
    expect(data.total).toBeGreaterThanOrEqual(3);
    expect(data.admins).toBeGreaterThanOrEqual(1);
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("gus-customer", "gus-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/user-management/stats", {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});

