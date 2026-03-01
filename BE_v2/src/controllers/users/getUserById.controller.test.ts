import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Get User By ID Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should get a user by ID for admin", async () => {
    const admin = await createTestUser("gub-admin", "gub-admin@test.com", UserRole.ADMIN);
    const target = await createTestUser("gub-target", "gub-target@test.com");

    const response = await app.handle(
      new Request(`http://localhost/api/v1/users/${target.id}`, {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.username).toBe("gub-target");
    expect(data.user.id).toBe(target.id);
  });

  it("should return 404 for non-existent user", async () => {
    const admin = await createTestUser("gub-admin2", "gub-admin2@test.com", UserRole.ADMIN);
    const fakeId = "000000000000000000000001";

    const response = await app.handle(
      new Request(`http://localhost/api/v1/users/${fakeId}`, {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("gub-customer", "gub-customer@test.com", UserRole.CUSTOMER);
    const target = await createTestUser("gub-target2", "gub-target2@test.com");

    const response = await app.handle(
      new Request(`http://localhost/api/v1/users/${target.id}`, {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});

