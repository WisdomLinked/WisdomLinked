import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  jsonHeaders,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Create User Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should create a new user for admin", async () => {
    const admin = await createTestUser("cu-admin", "cu-admin@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/users", {
        method: "POST",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({
          username: "newuser",
          email: "newuser@test.com",
          password: "password123",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.username).toBe("newuser");
    expect(data.user.email).toBe("newuser@test.com");
    expect(data.user.id).toBeDefined();
  });

  it("should reject creation with missing fields", async () => {
    const admin = await createTestUser("cu-admin2", "cu-admin2@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/users", {
        method: "POST",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({
          username: "incomplete",
          // missing email and password
        }),
      })
    );

    expect(response.status).toBe(422);
  });

  it("should reject duplicate username or email", async () => {
    const admin = await createTestUser("cu-admin3", "cu-admin3@test.com", UserRole.ADMIN);
    // Create a user that will conflict
    await createTestUser("existing-user", "existing@test.com");

    const response = await app.handle(
      new Request("http://localhost/api/v1/users", {
        method: "POST",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({
          username: "existing-user",
          email: "other@test.com",
          password: "password123",
        }),
      })
    );

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("cu-customer", "cu-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/users", {
        method: "POST",
        headers: jsonHeaders(customer.token),
        body: JSON.stringify({
          username: "should-fail",
          email: "fail@test.com",
          password: "password123",
        }),
      })
    );

    expect(response.status).toBe(403);
  });
});

