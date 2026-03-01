import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  jsonHeaders,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Update Settings Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should update system settings for admin", async () => {
    const admin = await createTestUser("us-admin", "us-admin@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/settings", {
        method: "PUT",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({
          registrationEnabled: false,
          loginMethods: { local: true, discord: false },
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("Settings updated successfully");
    expect(data.settings).toBeDefined();
    expect(data.settings.registrationEnabled).toBe(false);
    expect(data.settings.loginMethods.local).toBe(true);
    expect(data.settings.loginMethods.discord).toBe(false);
  });

  it("should validate settings before update", async () => {
    const admin = await createTestUser("us2-admin", "us2-admin@test.com", UserRole.ADMIN);

    // Sending a non-boolean value for registrationEnabled should fail schema validation
    const response = await app.handle(
      new Request("http://localhost/api/v1/settings", {
        method: "PUT",
        headers: jsonHeaders(admin.token),
        body: JSON.stringify({
          registrationEnabled: "not-a-boolean",
        }),
      })
    );

    // Elysia returns 422 for schema validation failures
    expect(response.status).toBe(422);
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("us3-customer", "us3-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/settings", {
        method: "PUT",
        headers: jsonHeaders(customer.token),
        body: JSON.stringify({ registrationEnabled: true }),
      })
    );

    expect(response.status).toBe(403);
  });
});

