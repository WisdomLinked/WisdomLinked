import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
} from "../../../test/helpers";
import { PendingUserModel } from "../../models/PendingUser";
import { UserModel } from "../../models/User";
import { UserRole } from "../../config/roles";

let app: TestApp;

beforeAll(async () => {
  app = await createFreshTestApp();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

describe("Confirm Email Verification Controller", () => {
  describe("POST /api/v1/auth/email-verification/confirm", () => {
    it("should confirm email, create user, and return token + user", async () => {
      await PendingUserModel.create({
        email: "confirm@test.com",
        username: "confirmuser",
        password: "hashed_password",
        role: UserRole.CUSTOMER,
        verificationCode: "123456",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        schemaVersion: 1,
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "confirm@test.com", code: "123456" }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("token");
      expect(data.user).toHaveProperty("username", "confirmuser");
      expect(data.user).toHaveProperty("role", UserRole.CUSTOMER);
    });

    it("should delete PendingUser after successful confirmation", async () => {
      await PendingUserModel.create({
        email: "confirm-delete@test.com",
        username: "confirmdelete",
        password: "hashed_password",
        role: UserRole.CUSTOMER,
        verificationCode: "654321",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        schemaVersion: 1,
      });

      await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "confirm-delete@test.com", code: "654321" }),
        })
      );

      const pending = await PendingUserModel.findOne({
        email: "confirm-delete@test.com",
      }).lean();
      expect(pending).toBeNull();

      const user = await UserModel.findOne({ email: "confirm-delete@test.com" }).lean();
      expect(user).not.toBeNull();
    });

    it("should reject an incorrect verification code", async () => {
      await PendingUserModel.create({
        email: "badcode@test.com",
        username: "badcodeuser",
        password: "hashed_password",
        role: UserRole.CUSTOMER,
        verificationCode: "111111",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        schemaVersion: 1,
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "badcode@test.com", code: "999999" }),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should reject an expired verification code", async () => {
      await PendingUserModel.create({
        email: "expired@test.com",
        username: "expireduser",
        password: "hashed_password",
        role: UserRole.CUSTOMER,
        verificationCode: "222222",
        expiresAt: new Date(Date.now() - 1000), // already expired
        schemaVersion: 1,
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "expired@test.com", code: "222222" }),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should reject when no PendingUser exists for email", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "nobody@test.com", code: "123456" }),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should reject with missing fields", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/email-verification/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@test.com" }),
        })
      );

      expect(response.status).toBe(422);
    });
  });
});
