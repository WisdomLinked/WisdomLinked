import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";

describe("Get User Sessions Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should return user's own sessions", async () => {
    const user = await createTestUser(
      "sessions-owner",
      "sessions-owner@test.com"
    );

    const response = await app.handle(
      new Request("http://localhost/api/v1/sessions/my-sessions", {
        method: "GET",
        headers: authHeader(user.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toBeDefined();
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(data.sessions.length).toBeGreaterThanOrEqual(1);
    // The session used for this request must be marked as current
    const currentSession = data.sessions.find(
      (s: { isCurrent: boolean }) => s.isCurrent === true
    );
    expect(currentSession).toBeDefined();
  });

  it("should reject request without authentication", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/sessions/my-sessions", {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
  });
});

