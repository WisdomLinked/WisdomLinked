import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { generateToken } from "../../utils/jwt";
import { SessionModel } from "../../models/Session";

describe("Revoke All Sessions Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should revoke all user sessions except current", async () => {
    const user = await createTestUser("multi-session-user", "multi-session-user@test.com");
    const secondaryToken = generateToken({
      userId: user.id,
      username: `${user.username}-secondary`,
      email: `secondary-${user.email}`,
      role: user.role,
    });

    await SessionModel.create({
      userId: user.id,
      token: secondaryToken,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent-secondary",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: true,
      lastActivity: new Date(),
    });

    const revokeResponse = await app.handle(
      new Request("http://localhost/api/v1/sessions", {
        method: "DELETE",
        headers: authHeader(user.token),
      })
    );
    expect(revokeResponse.status).toBe(200);

    const currentTokenResponse = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: authHeader(user.token),
      })
    );
    expect(currentTokenResponse.status).toBe(200);

    const secondaryTokenResponse = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: authHeader(secondaryToken),
      })
    );
    expect(secondaryTokenResponse.status).toBe(401);
  });

  it("should reject without authentication", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/sessions", {
        method: "DELETE",
      })
    );
    expect(response.status).toBe(401);
  });
});

