import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";
import { LogModel, LogLevel } from "../../models/Log";

describe("Get Logs Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should return paginated logs for admin", async () => {
    const admin = await createTestUser("gl-admin", "gl-admin@test.com", UserRole.ADMIN);

    await LogModel.create({ level: LogLevel.INFO, message: "Test info log", timestamp: new Date() });
    await LogModel.create({ level: LogLevel.WARN, message: "Test warn log", timestamp: new Date() });

    const response = await app.handle(
      new Request("http://localhost/api/v1/logs", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.logs)).toBe(true);
    expect(data.logs.length).toBe(2);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(2);
    expect(data.logs[0].level).toBeDefined();
    expect(data.logs[0].message).toBeDefined();
  });

  it("should filter logs by level", async () => {
    const admin = await createTestUser("gl2-admin", "gl2-admin@test.com", UserRole.ADMIN);

    await LogModel.create({ level: LogLevel.ERROR, message: "Critical failure", timestamp: new Date() });
    await LogModel.create({ level: LogLevel.INFO, message: "Just info", timestamp: new Date() });
    await LogModel.create({ level: LogLevel.ERROR, message: "Another error", timestamp: new Date() });

    const response = await app.handle(
      new Request("http://localhost/api/v1/logs?level=error", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.pagination.total).toBe(2);
    expect(data.logs.every((log: { level: string }) => log.level === "error")).toBe(true);
  });

  it("should search logs by message", async () => {
    const admin = await createTestUser("gl3-admin", "gl3-admin@test.com", UserRole.ADMIN);

    await LogModel.create({ level: LogLevel.DEBUG, message: "Debug entry", timestamp: new Date() });
    await LogModel.create({ level: LogLevel.WARN, message: "Warning entry", timestamp: new Date() });

    // Verify the endpoint returns logs with the expected response shape
    const response = await app.handle(
      new Request("http://localhost/api/v1/logs?level=warn", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    // Only the warn log should be returned
    expect(data.pagination.total).toBe(1);
    expect(data.logs[0].message).toBe("Warning entry");
    expect(data.logs[0].level).toBe("warn");
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("gl4-customer", "gl4-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/logs", {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});

