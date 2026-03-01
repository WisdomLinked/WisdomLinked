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

describe("Get Metrics Summary Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should return metrics summary for admin", async () => {
    const admin = await createTestUser("gms-admin", "gms-admin@test.com", UserRole.ADMIN);

    await MetricsModel.create({
      path: "/api/v1/auth/me",
      method: "GET",
      ip: "127.0.0.1",
      isAuthenticated: true,
      timestamp: new Date(),
      responseTime: 15,
      statusCode: 200,
    });
    await MetricsModel.create({
      path: "/api/v1/logs",
      method: "GET",
      ip: "127.0.0.1",
      isAuthenticated: false,
      timestamp: new Date(),
      responseTime: 5,
      statusCode: 401,
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/metrics/summary", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.summary).toBeDefined();
    expect(data.summary.totalRequests).toBe(2);
    expect(data.summary.authenticatedRequests).toBe(1);
    expect(data.summary.anonymousRequests).toBe(1);
    expect(data.summary.uniquePaths).toBe(2);
    expect(Array.isArray(data.topEndpoints)).toBe(true);
    expect(Array.isArray(data.recentActivity)).toBe(true);
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("gms2-customer", "gms2-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/metrics/summary", {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});

