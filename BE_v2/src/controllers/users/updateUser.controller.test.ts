import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  jsonHeaders,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Update User Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should update a user for admin", async () => {
    const admin = await createTestUser("uu-admin", "uu-admin@test.com", UserRole.ADMIN);
    const target = await createTestUser("uu-target", "uu-target@test.com");

    // Route is /:id/:id (prefix + controller both have /:id) — repeat id in both segments
    const response = await app.handle(
      new Request(`http://localhost/api/v1/users/${target.id}/${target.id}`, {
        method: "PUT",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({ username: "uu-updated" }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.username).toBe("uu-updated");
    expect(data.user.id).toBe(target.id);
  });

  it("should return 404 for non-existent user", async () => {
    const admin = await createTestUser("uu-admin2", "uu-admin2@test.com", UserRole.ADMIN);
    const fakeId = "000000000000000000000001";

    const response = await app.handle(
      new Request(`http://localhost/api/v1/users/${fakeId}/${fakeId}`, {
        method: "PUT",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({ username: "updated" }),
      })
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("uu-customer", "uu-customer@test.com", UserRole.CUSTOMER);
    const target = await createTestUser("uu-target2", "uu-target2@test.com");

    const response = await app.handle(
      new Request(`http://localhost/api/v1/users/${target.id}/${target.id}`, {
        method: "PUT",
        headers: jsonHeaders(customer.token),
        body: JSON.stringify({ username: "should-fail" }),
      })
    );

    expect(response.status).toBe(403);
  });
});

