import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshTestApp, type TestApp } from "../../../test/helpers";

describe("Get User Sessions Controller", () => {
  let _app: TestApp;

  beforeAll(async () => {
    _app = await createFreshTestApp();
  });

  it("should return user's own sessions", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  it("should reject request without authentication", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});

