import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  jsonHeaders,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Reset User Password Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should reset user password for admin", async () => {
    const admin = await createTestUser("rup-admin", "rup-admin@test.com", UserRole.ADMIN);
    const target = await createTestUser("rup-target", "rup-target@test.com");

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/user-management/users/${target.id}/reset-password`,
        {
          method: "POST",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ newPassword: "newpassword123" }),
        }
      )
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBeDefined();
    expect(data.user.id).toBe(target.id);
  });

  it("should reject invalid password (too short)", async () => {
    const admin = await createTestUser("rup-admin2", "rup-admin2@test.com", UserRole.ADMIN);
    const target = await createTestUser("rup-target2", "rup-target2@test.com");

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/user-management/users/${target.id}/reset-password`,
        {
          method: "POST",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ newPassword: "abc" }),
        }
      )
    );

    // Elysia schema validation: minLength: 6 fails → 422
    expect(response.status).toBe(422);
  });

  it("should invalidate sessions after reset", async () => {
    const admin = await createTestUser("rup-admin3", "rup-admin3@test.com", UserRole.ADMIN);
    const target = await createTestUser("rup-session", "rup-session@test.com");
    const oldToken = target.token;

    // Reset the password — invalidates all sessions for that user
    await app.handle(
      new Request(
        `http://localhost/api/v1/user-management/users/${target.id}/reset-password`,
        {
          method: "POST",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ newPassword: "newpassword123" }),
        }
      )
    );

    // Old session token should now be rejected
    const meResponse = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: authHeader(oldToken),
      })
    );

    expect(meResponse.status).toBe(401);
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("rup-customer", "rup-customer@test.com", UserRole.CUSTOMER);
    const target = await createTestUser("rup-target3", "rup-target3@test.com");

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/user-management/users/${target.id}/reset-password`,
        {
          method: "POST",
          headers: jsonHeaders(customer.token),
          body: JSON.stringify({ newPassword: "newpassword123" }),
        }
      )
    );

    expect(response.status).toBe(403);
  });
});

