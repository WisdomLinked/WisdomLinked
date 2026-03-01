import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Generate Password Reset Link Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should generate password reset link for admin", async () => {
    const admin = await createTestUser("gprl-admin", "gprl-admin@test.com", UserRole.ADMIN);
    const target = await createTestUser("gprl-target", "gprl-target@test.com");

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/user-management/users/${target.id}/generate-reset-link`,
        {
          method: "POST",
          headers: authHeader(admin.token),
        }
      )
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.resetToken).toBeDefined();
    expect(data.resetLink).toBeDefined();
    expect(data.expiresAt).toBeDefined();
    expect(data.message).toBeDefined();
  });

  it("should handle non-existent user", async () => {
    const admin = await createTestUser("gprl-admin2", "gprl-admin2@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request(
        "http://localhost/api/v1/user-management/users/000000000000000000000001/generate-reset-link",
        {
          method: "POST",
          headers: authHeader(admin.token),
        }
      )
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("gprl-customer", "gprl-customer@test.com", UserRole.CUSTOMER);
    const target = await createTestUser("gprl-target2", "gprl-target2@test.com");

    const response = await app.handle(
      new Request(
        `http://localhost/api/v1/user-management/users/${target.id}/generate-reset-link`,
        {
          method: "POST",
          headers: authHeader(customer.token),
        }
      )
    );

    expect(response.status).toBe(403);
  });
});

