import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  createFreshTestApp,
  createTestUser,
  type TestApp,
  wipeTestDatabase,
} from "../../../test/helpers";
import { PendingLoginModel } from "../../models/PendingLogin";
import { UserRole } from "../../config/roles";

let app: TestApp;

beforeAll(async () => {
  app = await createFreshTestApp();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

describe("Verify OTP Controller", () => {
  describe("POST /api/v1/auth/otp/verify", () => {
    it("should verify a valid OTP and return token + user", async () => {
      await createTestUser("otp-verify", "otp-verify@test.com", UserRole.CUSTOMER);

      await PendingLoginModel.create({
        email: "otp-verify@test.com",
        code: "123456",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        schemaVersion: 1,
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "otp-verify@test.com", code: "123456" }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("token");
      expect(data.user).toHaveProperty("username", "otp-verify");
    });

    it("should delete PendingLogin after successful verification", async () => {
      await createTestUser("otp-delete", "otp-delete@test.com", UserRole.CUSTOMER);

      await PendingLoginModel.create({
        email: "otp-delete@test.com",
        code: "654321",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        schemaVersion: 1,
      });

      await app.handle(
        new Request("http://localhost/api/v1/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "otp-delete@test.com", code: "654321" }),
        })
      );

      const pending = await PendingLoginModel.findOne({ email: "otp-delete@test.com" }).lean();
      expect(pending).toBeNull();
    });

    it("should reject an incorrect OTP code", async () => {
      await createTestUser("otp-wrong", "otp-wrong@test.com", UserRole.CUSTOMER);

      await PendingLoginModel.create({
        email: "otp-wrong@test.com",
        code: "111111",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        schemaVersion: 1,
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "otp-wrong@test.com", code: "999999" }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject an expired OTP", async () => {
      await createTestUser("otp-expired", "otp-expired@test.com", UserRole.CUSTOMER);

      await PendingLoginModel.create({
        email: "otp-expired@test.com",
        code: "222222",
        expiresAt: new Date(Date.now() - 1000), // already expired
        schemaVersion: 1,
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "otp-expired@test.com", code: "222222" }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject when no PendingLogin exists for email", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "nobody@test.com", code: "123456" }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject with invalid body schema", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@test.com" }), // missing code
        })
      );

      expect(response.status).toBe(422);
    });
  });
});
