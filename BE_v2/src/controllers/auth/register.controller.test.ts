import { beforeAll, describe, expect, it } from "bun:test";
import { 
  createFreshTestApp,
  type TestApp,
} from "../../../test/helpers";

let app: TestApp;

beforeAll(async () => {
  app = await createFreshTestApp();
});

describe("Register Controller", () => {
  describe("POST /api/v1/auth/register", () => {
    it("should register a new user successfully", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "newuser",
            email: "newuser@example.com",
            password: "password123",
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("token");
      expect(data.user).toHaveProperty("username", "newuser");
    });

    it("should reject registration with missing fields", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "incomplete",
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    it("should reject registration with duplicate username", async () => {
      // First registration
      await app.handle(
        new Request("http://localhost/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "testuser",
            email: "test@example.com",
            password: "password123",
          }),
        })
      );

      // Attempt duplicate
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "testuser",
            email: "another@example.com",
            password: "password123",
          }),
        })
      );

      expect(response.status).toBe(409);
    });
  });
});

