import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  createFreshTestApp,
  createTestUser,
  type TestApp,
  wipeTestDatabase,
} from "../../../test/helpers";
import { PendingPasswordResetModel } from "../../models/PendingPasswordReset";
import { SessionModel } from "../../models/Session";
import { UserModel } from "../../models/User";
import { UserRole } from "../../config/roles";

let app: TestApp;

beforeAll(async () => {
  app = await createFreshTestApp();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

describe("Reset Password Controller", () => {
  describe("POST /api/v1/auth/reset-password", () => {
    it("should reset password with valid code and clear sessions", async () => {
      const user = await createTestUser(
        "reset-user",
        "reset-user@test.com",
        UserRole.CUSTOMER
      );

      await PendingPasswordResetModel.create({
        email: "reset-user@test.com",
        code: "123456",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        schemaVersion: 1,
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "reset-user@test.com",
            code: "123456",
            newPassword: "newsecurepassword",
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Password reset successful");

      // Verify sessions were cleared
      const sessions = await SessionModel.find({ userId: user.id }).lean();
      expect(sessions).toHaveLength(0);

      // Verify PendingPasswordReset was deleted
      const pending = await PendingPasswordResetModel.findOne({
        email: "reset-user@test.com",
      }).lean();
      expect(pending).toBeNull();
    });

    it("should reject invalid reset code", async () => {
      await createTestUser("reset-badcode", "reset-badcode@test.com", UserRole.CUSTOMER);

      await PendingPasswordResetModel.create({
        email: "reset-badcode@test.com",
        code: "111111",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        schemaVersion: 1,
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "reset-badcode@test.com",
            code: "999999",
            newPassword: "newpassword123",
          }),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should reject an expired reset code", async () => {
      await createTestUser("reset-expired", "reset-expired@test.com", UserRole.CUSTOMER);

      await PendingPasswordResetModel.create({
        email: "reset-expired@test.com",
        code: "222222",
        expiresAt: new Date(Date.now() - 1000), // already expired
        schemaVersion: 1,
      });

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "reset-expired@test.com",
            code: "222222",
            newPassword: "newpassword123",
          }),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should reject when no reset record exists", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "nobody@test.com",
            code: "123456",
            newPassword: "newpassword123",
          }),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should reject with password shorter than 8 characters", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@test.com",
            code: "123456",
            newPassword: "short",
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    it("should verify the user's password is actually updated after reset", async () => {
      await createTestUser("reset-verify", "reset-verify@test.com", UserRole.CUSTOMER);

      await PendingPasswordResetModel.create({
        email: "reset-verify@test.com",
        code: "333333",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        schemaVersion: 1,
      });

      const beforeUser = await UserModel.findOne({ email: "reset-verify@test.com" }).select("+password").lean();
      const originalPassword = beforeUser?.password;

      await app.handle(
        new Request("http://localhost/api/v1/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "reset-verify@test.com",
            code: "333333",
            newPassword: "mynewpassword123",
          }),
        })
      );

      const afterUser = await UserModel.findOne({ email: "reset-verify@test.com" }).select("+password").lean();
      expect(afterUser?.password).not.toBe(originalPassword);
    });
  });
});
