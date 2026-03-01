import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Delete User Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should delete a user for admin", async () => {
    const admin = await createTestUser("du-admin", "du-admin@test.com", UserRole.ADMIN);
    const target = await createTestUser("du-target", "du-target@test.com");

    const response = await app.handle(
      new Request(`http://localhost/api/v1/users/${target.id}`, {
        method: "DELETE",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("User deleted successfully");
  });

  it("should return 404 for non-existent user", async () => {
    const admin = await createTestUser("du-admin2", "du-admin2@test.com", UserRole.ADMIN);
    const fakeId = "000000000000000000000001";

    const response = await app.handle(
      new Request(`http://localhost/api/v1/users/${fakeId}`, {
        method: "DELETE",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("du-customer", "du-customer@test.com", UserRole.CUSTOMER);
    const target = await createTestUser("du-target2", "du-target2@test.com");

    const response = await app.handle(
      new Request(`http://localhost/api/v1/users/${target.id}`, {
        method: "DELETE",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });

  it("should invalidate user sessions on delete", async () => {
    const admin = await createTestUser("du-admin3", "du-admin3@test.com", UserRole.ADMIN);
    const target = await createTestUser("du-session-user", "du-session@test.com");

    const deleteResponse = await app.handle(
      new Request(`http://localhost/api/v1/users/${target.id}`, {
        method: "DELETE",
        headers: authHeader(admin.token),
      })
    );
    expect(deleteResponse.status).toBe(200);

    // Target's token should now be invalid (session invalidated, user deleted)
    const meResponse = await app.handle(
      new Request("http://localhost/api/v1/auth/me", {
        method: "GET",
        headers: authHeader(target.token),
      })
    );

    expect(meResponse.status).toBe(401);
  });
});

