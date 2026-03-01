import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";
import { MetricsModel } from "../../models/Metrics";

describe("Clear Metrics Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should clear all metrics for admin", async () => {
    const admin = await createTestUser("cm-admin", "cm-admin@test.com", UserRole.ADMIN);

    await MetricsModel.create({
      path: "/api/v1/auth/me",
      method: "GET",
      ip: "127.0.0.1",
      isAuthenticated: true,
      timestamp: new Date(),
      statusCode: 200,
    });
    await MetricsModel.create({
      path: "/api/v1/metrics",
      method: "GET",
      ip: "10.0.0.1",
      isAuthenticated: true,
      timestamp: new Date(),
      statusCode: 200,
    });

    const countBefore = await MetricsModel.countDocuments();
    expect(countBefore).toBe(2);

    const response = await app.handle(
      new Request("http://localhost/api/v1/metrics", {
        method: "DELETE",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("Metrics cleared successfully");

    const countAfter = await MetricsModel.countDocuments();
    expect(countAfter).toBe(0);
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("cm2-customer", "cm2-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/metrics", {
        method: "DELETE",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});

