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
import { UserModel, AuthMethod } from "../../models/User";
import { generateToken } from "../../utils/jwt";
import { SessionModel } from "../../models/Session";

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
    // Must explicitly set authMethods — createTestUser default may not include LOCAL
    const targetDoc = await UserModel.create({
      username: "rup-target",
      email: "rup-target@test.com",
      password: "hashedpassword123",
      role: UserRole.CUSTOMER,
      isActive: true,
      authMethods: [AuthMethod.LOCAL],
    });
    const targetId = targetDoc._id.toString();

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/user-management/users/${targetId}/reset-password`,
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
    expect(data.user.id).toBe(targetId);
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

    // Must explicitly set authMethods so password reset succeeds
    const targetDoc = await UserModel.create({
      username: "rup-session",
      email: "rup-session@test.com",
      password: "hashedpassword123",
      role: UserRole.CUSTOMER,
      isActive: true,
      authMethods: [AuthMethod.LOCAL],
    });
    const targetId = targetDoc._id.toString();

    // Create a session for this user
    const targetToken = generateToken({
      userId: targetId,
      username: "rup-session",
      email: "rup-session@test.com",
      role: UserRole.CUSTOMER,
    });
    await SessionModel.create({
      userId: targetId,
      token: targetToken,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: true,
    });

    // Reset the password — invalidates all sessions for that user
    const resetResponse = await app.handle(
      new Request(
        `http://localhost/api/v1/user-management/users/${targetId}/reset-password`,
        {
          method: "POST",
          headers: jsonHeaders(admin.token),
          body: JSON.stringify({ newPassword: "newpassword123" }),
        }
      )
    );
    expect(resetResponse.status).toBe(200);

    // Old session token should now be rejected
    const meResponse = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: authHeader(targetToken),
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

