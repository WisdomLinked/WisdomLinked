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

describe("Request OTP Controller", () => {
  describe("POST /api/v1/auth/otp/request", () => {
    it("should always return success message regardless of whether email exists", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "nonexistent@example.com" }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("OTP sent");
    });

    it("should create a PendingLogin record when user exists", async () => {
      await createTestUser("otp-user", "otp-user@test.com", UserRole.CUSTOMER);

      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "otp-user@test.com" }),
        })
      );

      expect(response.status).toBe(200);

      const pending = await PendingLoginModel.findOne({
        email: "otp-user@test.com",
      }).lean();
      expect(pending).not.toBeNull();
      expect(pending?.code).toHaveLength(6);
      expect(pending?.expiresAt).toBeInstanceOf(Date);
    });

    it("should overwrite an existing PendingLogin for the same email", async () => {
      await createTestUser("otp-user2", "otp-user2@test.com", UserRole.CUSTOMER);

      // First request
      await app.handle(
        new Request("http://localhost/api/v1/auth/otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "otp-user2@test.com" }),
        })
      );

      const first = await PendingLoginModel.findOne({ email: "otp-user2@test.com" }).lean();

      // Second request
      await app.handle(
        new Request("http://localhost/api/v1/auth/otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "otp-user2@test.com" }),
        })
      );

      const count = await PendingLoginModel.countDocuments({ email: "otp-user2@test.com" });
      expect(count).toBe(1);

      const second = await PendingLoginModel.findOne({ email: "otp-user2@test.com" }).lean();
      // Code may differ between requests
      expect(second?.code).toHaveLength(6);
      expect(first?._id?.toString()).toBe(second?._id?.toString());
    });

    it("should reject request with invalid email format", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "not-an-email" }),
        })
      );

      expect(response.status).toBe(422);
    });

    it("should reject request with missing body", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/auth/otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(422);
    });
  });
});
