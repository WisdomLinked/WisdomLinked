import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { SessionModel } from "../../models/Session";

describe("Revoke Session Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should revoke a specific session", async () => {
    const user = await createTestUser("revoke-user", "revoke-user@test.com");

    // Locate the session that was created for this user
    const session = await SessionModel.findOne({
      userId: user.id,
      isActive: true,
    }).lean();
    if (!session) {
      throw new Error("Expected an active session after createTestUser");
    }
    const sessionId = session._id.toString();

    // requireAuth validates the token BEFORE the handler revokes the session,
    // so using the same token here is intentional and correct.
    const response = await app.handle(
      new Request(`http://localhost/api/v1/sessions/${sessionId}`, {
        method: "DELETE",
        headers: authHeader(user.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("Session revoked successfully");
  });

  it("should reject revoke without authentication", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/sessions/507f1f77bcf86cd799439011", {
        method: "DELETE",
      })
    );

    expect(response.status).toBe(401);
  });

  it("should handle non-existent session", async () => {
    const user = await createTestUser(
      "no-session-user",
      "no-session-user@test.com"
    );

    // Valid ObjectId format but no matching session for this user
    const response = await app.handle(
      new Request(
        "http://localhost/api/v1/sessions/507f1f77bcf86cd799439011",
        {
          method: "DELETE",
          headers: authHeader(user.token),
        }
      )
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Session not found");
  });
});

