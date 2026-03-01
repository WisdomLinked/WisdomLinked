import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  createFreshTestApp,
  createTestUser,
  jsonHeaders,
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

describe("Update Profile Controller", () => {
  describe("PUT /api/v1/profile", () => {
    it("should update shared fields for a customer", async () => {
      const user = await createTestUser("update-customer", "update-customer@test.com", UserRole.CUSTOMER);

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile", {
          method: "PUT",
          headers: jsonHeaders(user.token),
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            country: "US",
            city: "New York",
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.phoneNumber).toBe("+1234567890");
      expect(data.user.country).toBe("US");
      expect(data.user.city).toBe("New York");
    });

    it("should allow expert to update expert-specific fields", async () => {
      const expert = await createTestUser("update-expert", "update-expert@test.com", UserRole.EXPERT);

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile", {
          method: "PUT",
          headers: jsonHeaders(expert.token),
          body: JSON.stringify({
            title: "Senior Software Engineer",
            description: "Expert in TypeScript and Node.js",
            price: [100, 150],
            timeSlots: [9, 10, 14, 15],
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.title).toBe("Senior Software Engineer");
      expect(data.user.description).toBe("Expert in TypeScript and Node.js");
    });

    it("should reject expert-only fields for a customer", async () => {
      const customer = await createTestUser(
        "customer-expert-fields",
        "customer-expert@test.com",
        UserRole.CUSTOMER
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile", {
          method: "PUT",
          headers: jsonHeaders(customer.token),
          body: JSON.stringify({ title: "Should be rejected" }),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should return 400 when no updatable fields provided", async () => {
      const user = await createTestUser("empty-update", "empty-update@test.com", UserRole.CUSTOMER);

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile", {
          method: "PUT",
          headers: jsonHeaders(user.token),
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should reject unauthenticated request", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country: "US" }),
        })
      );

      expect(response.status).toBe(401);
    });

    it("should not return password in response", async () => {
      const user = await createTestUser("no-pass", "no-pass@test.com", UserRole.CUSTOMER);

      const response = await app.handle(
        new Request("http://localhost/api/v1/profile", {
          method: "PUT",
          headers: jsonHeaders(user.token),
          body: JSON.stringify({ city: "Boston" }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user).not.toHaveProperty("password");
    });
  });
});
