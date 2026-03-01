import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Get Sessions For User Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should allow admin to get user sessions", async () => {
    const admin = await createTestUser(
      "admin-sessions",
      "admin-sessions@test.com",
      UserRole.ADMIN
    );
    const targetUser = await createTestUser(
      "target-sessions",
      "target-sessions@test.com"
    );

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/sessions/user/${targetUser.id}`,
        {
          method: "GET",
          headers: authHeader(admin.token),
        }
      )
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toBeDefined();
    expect(Array.isArray(data.sessions)).toBe(true);
  });

  it("should reject non-admin users", async () => {
    const regularUser = await createTestUser(
      "regular-sessions",
      "regular-sessions@test.com"
    );
    const targetUser = await createTestUser(
      "target-sessions2",
      "target-sessions2@test.com"
    );

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/sessions/user/${targetUser.id}`,
        {
          method: "GET",
          headers: authHeader(regularUser.token),
        }
      )
    );

    expect(response.status).toBe(403);
  });
});

