import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";

describe("Get Settings Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should return system settings for admin", async () => {
    const admin = await createTestUser("gs-admin", "gs-admin@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/settings", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.settings).toBeDefined();
    expect(typeof data.settings.registrationEnabled).toBe("boolean");
    expect(data.settings.loginMethods).toBeDefined();
    expect(typeof data.settings.loginMethods.local).toBe("boolean");
    expect(data.settings.discordOAuth).toBeDefined();
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("gs2-customer", "gs2-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/settings", {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});

