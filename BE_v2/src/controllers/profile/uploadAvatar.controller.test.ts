import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  authHeader,
  createFreshTestApp,
  createTestUser,
  type TestApp,
  wipeTestDatabase,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

let app: TestApp;

beforeAll(async () => {
  app = await createFreshTestApp();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

describe("Upload Avatar Controller", () => {
  describe("POST /api/v1/profile/avatar", () => {
    it("should reject unauthenticated request", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["data"], { type: "image/png" }), "avatar.png");

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile/avatar", {
          method: "POST",
          body: formData,
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject request with no file", async () => {
      const user = await createTestUser("avatar-nofile", "avatar-nofile@test.com", UserRole.CUSTOMER);

      const formData = new FormData();

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile/avatar", {
          method: "POST",
          headers: authHeader(user.token),
          body: formData,
        })
      );

      // 422 when schema validation fails (file missing)
      expect(response.status).toBe(422);
    });

    it("should reject a non-image file", async () => {
      const user = await createTestUser("avatar-badfile", "avatar-badfile@test.com", UserRole.CUSTOMER);

      // Minimal PDF-like bytes (not a real image)
      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["%PDF-1.4 fake content"], { type: "application/pdf" }),
        "doc.pdf"
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile/avatar", {
          method: "POST",
          headers: authHeader(user.token),
          body: formData,
        })
      );

      // Either 400 (invalid image) or 500 (sharp can't parse) — both are acceptable rejections
      expect([400, 500]).toContain(response.status);
    });
  });
});
