import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Revoke User Sessions Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should allow admin to revoke user sessions", async () => {
    const admin = await createTestUser(
      "admin-revoke",
      "admin-revoke@test.com",
      UserRole.ADMIN
    );
    const targetUser = await createTestUser(
      "target-revoke",
      "target-revoke@test.com"
    );

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/sessions/user/${targetUser.id}`,
        {
          method: "DELETE",
          headers: authHeader(admin.token),
        }
      )
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain("revoked successfully");
  });

  it("should reject non-admin users", async () => {
    const regularUser = await createTestUser(
      "regular-revoke",
      "regular-revoke@test.com"
    );
    const targetUser = await createTestUser(
      "target-revoke2",
      "target-revoke2@test.com"
    );

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/sessions/user/${targetUser.id}`,
        {
          method: "DELETE",
          headers: authHeader(regularUser.token),
        }
      )
    );

    expect(response.status).toBe(403);
  });
});

