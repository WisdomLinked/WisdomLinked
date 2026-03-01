import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  createFreshTestApp,
  createTestUser,
  type TestApp,
  wipeTestDatabase,
} from "../../../test/helpers";
import { PendingPasswordResetModel } from "../../models/PendingPasswordReset";
import { UserRole } from "../../config/roles";

let app: TestApp;

beforeAll(async () => {
  app = await createFreshTestApp();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

describe("Forgot Password Controller", () => {
  describe("POST /api/v1/auth/forgot-password", () => {
    it("should always return success regardless of whether email exists", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "nonexistent@test.com" }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Reset email sent");
    });

    it("should create a PendingPasswordReset when user exists", async () => {
      await createTestUser("forgot-user", "forgot-user@test.com", UserRole.CUSTOMER);

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "forgot-user@test.com" }),
        })
      );

      expect(response.status).toBe(200);

      const pending = await PendingPasswordResetModel.findOne({
        email: "forgot-user@test.com",
      }).lean();
      expect(pending).not.toBeNull();
      expect(pending?.code).toHaveLength(6);
    });

    it("should overwrite existing PendingPasswordReset for same email", async () => {
      await createTestUser("forgot-overwrite", "forgot-overwrite@test.com", UserRole.CUSTOMER);

      await app.handle(
        new Request("http://localhost/api/v1/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "forgot-overwrite@test.com" }),
        })
      );

      await app.handle(
        new Request("http://localhost/api/v1/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "forgot-overwrite@test.com" }),
        })
      );

      const count = await PendingPasswordResetModel.countDocuments({
        email: "forgot-overwrite@test.com",
      });
      expect(count).toBe(1);
    });

    it("should reject invalid email format", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "not-an-email" }),
        })
      );

      expect(response.status).toBe(422);
    });
  });
});
