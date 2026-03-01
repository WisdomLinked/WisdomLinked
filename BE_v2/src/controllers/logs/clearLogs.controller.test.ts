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

describe("Clear Logs Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should clear all logs for admin", async () => {
    const admin = await createTestUser("cl-admin", "cl-admin@test.com", UserRole.ADMIN);

    await LogModel.create({ level: LogLevel.INFO, message: "Log one", timestamp: new Date() });
    await LogModel.create({ level: LogLevel.ERROR, message: "Log two", timestamp: new Date() });

    const countBefore = await LogModel.countDocuments();
    expect(countBefore).toBe(2);

    const response = await app.handle(
      new Request("http://localhost/api/v1/logs", {
        method: "DELETE",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("Logs cleared successfully");

    const countAfter = await LogModel.countDocuments();
    expect(countAfter).toBe(0);
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("cl2-customer", "cl2-customer@test.com", UserRole.CUSTOMER);

    const response = await app.handle(
      new Request("http://localhost/api/v1/logs", {
        method: "DELETE",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });

  it("should reject unauthenticated requests", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/logs", {
        method: "DELETE",
      })
    );

    expect(response.status).toBe(401);
  });
});

