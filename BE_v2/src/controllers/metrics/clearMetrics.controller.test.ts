import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshTestApp, type TestApp } from "../../../test/helpers";

describe("Clear Metrics Controller", () => {
  let _app: TestApp;

  beforeAll(async () => {
    _app = await createFreshTestApp();
  });

  it("should clear all metrics for admin", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  it("should reject non-admin users", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});

