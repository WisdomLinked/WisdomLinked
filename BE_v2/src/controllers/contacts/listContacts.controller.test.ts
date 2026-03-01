import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
  createTestUser,
  authHeader,
} from "../../../test/helpers";
import { UserRole } from "../../config/roles";
import { ContactedUsModel } from "../../models/ContactedUs";

describe("List Contacts Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should list contacts for admin", async () => {
    const admin = await createTestUser("lco-admin", "lco-admin@test.com", UserRole.ADMIN);
    await ContactedUsModel.create([
      { name: "Alice", email: "alice@example.com", message: "Hello", isRead: false },
      { name: "Bob", email: "bob@example.com", message: "Hi there", isRead: true },
    ]);

    const response = await app.handle(
      new Request("http://localhost/api/v1/contacts", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(2);
    expect(data.pagination.page).toBe(1);
    expect(data.data[0].name).toBeDefined();
    expect(data.data[0].email).toBeDefined();
  });

  it("should filter by search query", async () => {
    const admin = await createTestUser("lco-admin2", "lco-admin2@test.com", UserRole.ADMIN);
    await ContactedUsModel.create([
      { name: "Charlie Brown", email: "charlie@example.com", message: "Hello", isRead: false },
      { name: "Dana White", email: "dana@example.com", message: "Hi there", isRead: false },
    ]);

    const response = await app.handle(
      new Request("http://localhost/api/v1/contacts?search=Charlie", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].name).toBe("Charlie Brown");
  });

  it("should filter by isRead status", async () => {
    const admin = await createTestUser("lco-admin3", "lco-admin3@test.com", UserRole.ADMIN);
    await ContactedUsModel.create([
      { name: "Read Contact", email: "read@example.com", message: "Already read", isRead: true },
      { name: "Unread Contact", email: "unread@example.com", message: "Not yet read", isRead: false },
    ]);

    const response = await app.handle(
      new Request("http://localhost/api/v1/contacts?isRead=false", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].name).toBe("Unread Contact");
    expect(data.data[0].isRead).toBe(false);
  });

  it("should paginate results sorted by createdAt desc", async () => {
    const admin = await createTestUser("lco-admin4", "lco-admin4@test.com", UserRole.ADMIN);
    await ContactedUsModel.create([
      { name: "Contact 1", email: "c1@example.com", message: "M1", isRead: false },
      { name: "Contact 2", email: "c2@example.com", message: "M2", isRead: false },
      { name: "Contact 3", email: "c3@example.com", message: "M3", isRead: false },
    ]);

    const response = await app.handle(
      new Request("http://localhost/api/v1/contacts?page=1&limit=2", {
        method: "GET",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(2);
    expect(data.pagination.total).toBe(3);
    expect(data.pagination.totalPages).toBe(2);
    expect(data.pagination.limit).toBe(2);
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("lco-customer", "lco-customer@test.com");

    const response = await app.handle(
      new Request("http://localhost/api/v1/contacts", {
        method: "GET",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});
