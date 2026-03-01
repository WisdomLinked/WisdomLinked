import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  createFreshTestApp,
  createTestUser,
  type TestApp,
  wipeTestDatabase,
} from "../../../test/helpers";
import { PendingUserModel } from "../../models/PendingUser";
import { UserRole } from "../../config/roles";

let app: TestApp;

beforeAll(async () => {
  app = await createFreshTestApp();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

describe("Request Email Verification Controller", () => {
  describe("POST /api/v1/auth/email-verification/request", () => {
    it("should create a PendingUser and return success for valid customer registration", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "newcustomer",
            email: "newcustomer@test.com",
            password: "password123",
            role: "customer",
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Verification email sent");

      const pending = await PendingUserModel.findOne({
        email: "newcustomer@test.com",
      }).lean();
      expect(pending).not.toBeNull();
      expect(pending?.username).toBe("newcustomer");
      expect(pending?.role).toBe(UserRole.CUSTOMER);
    });

    it("should create a PendingUser for expert registration", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "newexpert",
            email: "newexpert@test.com",
            password: "password123",
            role: "expert",
          }),
        })
      );

      expect(response.status).toBe(200);

      const pending = await PendingUserModel.findOne({
        email: "newexpert@test.com",
      }).lean();
      expect(pending?.role).toBe(UserRole.EXPERT);
    });

    it("should reject if a real user with that email already exists", async () => {
      await createTestUser("existing-email", "existing-email@test.com", UserRole.CUSTOMER);

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "brandnew",
            email: "existing-email@test.com",
            password: "password123",
            role: "customer",
          }),
        })
      );

      expect(response.status).toBe(409);
    });

    it("should reject if a real user with that username already exists", async () => {
      await createTestUser("taken-user", "taken@test.com", UserRole.CUSTOMER);

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "taken-user",
            email: "different@test.com",
            password: "password123",
            role: "customer",
          }),
        })
      );

      expect(response.status).toBe(409);
    });

    it("should reject with missing required fields", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "incomplete@test.com",
            password: "password123",
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    it("should reject with password shorter than 8 characters", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "shortpass",
            email: "shortpass@test.com",
            password: "short",
            role: "customer",
          }),
        })
      );

      expect(response.status).toBe(422);
    });
  });
});
