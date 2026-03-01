import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { SessionModel } from "../../models/Session";

describe("Get Current User Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should return current user with valid token", async () => {
    const user = await createTestUser("current-user", "current-user@test.com");

    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: authHeader(user.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.username).toBe("current-user");
    expect(data.user.email).toBe("current-user@test.com");
  });

  it("should reject request without token", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
  });

  it("should reject request with invalid token", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: authHeader("invalid.token.value"),
      })
    );

    expect(response.status).toBe(401);
  });

  it("should reject request immediately after session revocation", async () => {
    const user = await createTestUser("revoked-user", "revoked-user@test.com");
    await SessionModel.updateOne({ token: user.token }, { isActive: false });

    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: authHeader(user.token),
      })
    );

    expect(response.status).toBe(401);
  });
});

