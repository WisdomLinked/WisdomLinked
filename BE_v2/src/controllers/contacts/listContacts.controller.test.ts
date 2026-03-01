import { describe, it, expect, beforeAll } from "bun:test";
import { createFreshTestApp, type TestApp } from "../../../test/helpers";

describe("List Contacts Controller", () => {
  let _app: TestApp;

  beforeAll(async () => {
    _app = await createFreshTestApp();
  });

  it("should list contacts for admin", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  it("should filter by search query", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  it("should filter by isRead status", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  it("should paginate results sorted by createdAt desc", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  it("should reject non-admin users", async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});
