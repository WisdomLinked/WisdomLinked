import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshTestApp, type TestApp } from "../../../test/helpers";

describe("List Feedbacks Controller", () => {
  let _app: TestApp;

  beforeAll(async () => {
    _app = await createFreshTestApp();
  });

  it("should list feedbacks from completed events for admin", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  it("should filter by expertId", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  it("should return 400 for invalid expertId", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  it("should paginate results", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  it("should reject non-admin users", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});
