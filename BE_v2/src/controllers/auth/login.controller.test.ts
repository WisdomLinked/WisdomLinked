import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
} from "../../../test/helpers";

describe("Login Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should login successfully with valid credentials", async () => {
    // Register a user first so password is properly hashed
    await app.handle(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "loginuser",
          email: "loginuser@test.com",
          password: "password123",
        }),
      })
    );

    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "loginuser",
          password: "password123",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.token).toBeDefined();
    expect(data.user.username).toBe("loginuser");
    expect(data.user.email).toBe("loginuser@test.com");
    expect(data.user.role).toBeDefined();
  });

  it("should reject login with invalid credentials", async () => {
    await app.handle(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "loginuser2",
          email: "loginuser2@test.com",
          password: "password123",
        }),
      })
    );

    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "loginuser2",
          password: "wrongpassword",
        }),
      })
    );

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Invalid credentials");
  });

  it("should reject login with missing fields", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "someuser" }),
      })
    );

    expect(response.status).toBe(422);
  });
});

