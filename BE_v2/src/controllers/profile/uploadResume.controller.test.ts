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

describe("Upload Resume Controller", () => {
  describe("POST /api/v1/profile/resume", () => {
    it("should reject unauthenticated request", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["%PDF-1.4"], { type: "application/pdf" }), "resume.pdf");

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile/resume", {
          method: "POST",
          body: formData,
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject upload for customer role", async () => {
      const customer = await createTestUser(
        "resume-customer",
        "resume-customer@test.com",
        UserRole.CUSTOMER
      );

      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["%PDF-1.4 fake content"], { type: "application/pdf" }),
        "resume.pdf"
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile/resume", {
          method: "POST",
          headers: authHeader(customer.token),
          body: formData,
        })
      );

      expect(response.status).toBe(403);
    });

    it("should reject a non-PDF file for expert", async () => {
      const expert = await createTestUser(
        "resume-expert",
        "resume-expert@test.com",
        UserRole.EXPERT
      );

      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["not a pdf"], { type: "text/plain" }),
        "document.txt"
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile/resume", {
          method: "POST",
          headers: authHeader(expert.token),
          body: formData,
        })
      );

      expect(response.status).toBe(400);
    });

    it("should reject request with no file", async () => {
      const expert = await createTestUser(
        "resume-nofile",
        "resume-nofile@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile/resume", {
          method: "POST",
          headers: authHeader(expert.token),
          body: new FormData(),
        })
      );

      expect(response.status).toBe(422);
    });
  });
});
