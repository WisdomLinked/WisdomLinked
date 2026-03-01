import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Toggle User Status Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should toggle user active status for admin", async () => {
    const admin = await createTestUser("tus-admin", "tus-admin@test.com", UserRole.ADMIN);
    const target = await createTestUser("tus-target", "tus-target@test.com");

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/user-management/users/${target.id}/toggle-status`,
        {
          method: "PUT",
          headers: authHeader(admin.token),
        }
      )
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    // Target was active, should now be inactive
    expect(data.user.isActive).toBe(false);
    expect(data.user.id).toBe(target.id);
    expect(data.message).toBeDefined();
  });

  it("should handle non-existent user", async () => {
    const admin = await createTestUser("tus-admin2", "tus-admin2@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request(
        "http://localhost/api/v1/user-management/users/000000000000000000000001/toggle-status",
        {
          method: "PUT",
          headers: authHeader(admin.token),
        }
      )
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("tus-customer", "tus-customer@test.com", UserRole.CUSTOMER);
    const target = await createTestUser("tus-target2", "tus-target2@test.com");

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/user-management/users/${target.id}/toggle-status`,
        {
          method: "PUT",
          headers: authHeader(customer.token),
        }
      )
    );

    expect(response.status).toBe(403);
  });
});

