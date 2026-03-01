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

describe("Get Metrics Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should return paginated metrics for admin", async () => {
    const admin = await createTestUser("gm-admin", "gm-admin@test.com", UserRole.ADMIN);

    await MetricsModel.create({
      path: "/api/v1/auth/me",
      method: "GET",
      ip: "127.0.0.1",
      isAuthenticated: true,
      timestamp: new Date(),
      responseTime: 12,
      statusCode: 200,
    });
    await MetricsModel.create({
      path: "/api/v1/logs",
      method: "GET",
      ip: "127.0.0.1",
      isAuthenticated: false,
      timestamp: new Date(),
      responseTime: 8,
      statusCode: 401,
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/metrics", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.metrics)).toBe(true);
    expect(data.metrics.length).toBe(2);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(2);
    expect(data.metrics[0].path).toBeDefined();
    expect(data.metrics[0].method).toBeDefined();
  });

  it("should filter metrics by endpoint", async () => {
    const admin = await createTestUser("gm2-admin", "gm2-admin@test.com", UserRole.ADMIN);

    await MetricsModel.create({
      path: "/api/v1/auth/me",
      method: "GET",
      ip: "127.0.0.1",
      isAuthenticated: true,
      timestamp: new Date(),
      statusCode: 200,
    });
    await MetricsModel.create({
      path: "/api/v1/settings",
      method: "GET",
      ip: "127.0.0.1",
      isAuthenticated: true,
      timestamp: new Date(),
      statusCode: 200,
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/metrics?path=/api/v1/settings", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.pagination.total).toBe(1);
    expect(data.metrics[0].path).toBe("/api/v1/settings");
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("gm3-customer", "gm3-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/metrics", {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});

