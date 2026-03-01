import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";

describe("Logout Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should logout successfully with valid token", async () => {
    const user = await createTestUser("logout-user", "logout-user@test.com");

    const logoutResponse = await app.handle(
      new Request("http://localhost/api/v1/auth/logout", {
        method: "POST",
        headers: authHeader(user.token),
      })
    );
    expect(logoutResponse.status).toBe(200);

    // Same token should fail immediately after logout.
    const meResponse = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: authHeader(user.token),
      })
    );
    expect(meResponse.status).toBe(401);
  });

  it("should reject logout without token", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/logout", {
        method: "POST",
      })
    );
    expect(response.status).toBe(401);
  });
});

