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
import { Types } from "mongoose";

describe("Mark Contact Read Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should mark a contact as read as admin", async () => {
    const admin = await createTestUser("mcr-admin", "mcr-admin@test.com", UserRole.ADMIN);
    const contact = await ContactedUsModel.create({
      name: "Eve Smith",
      email: "eve@example.com",
      message: "Please help me with my account.",
      isRead: false,
    });

    const response = await app.handle(
      new Request(`http://localhost/api/v1/contacts/${contact._id.toString()}/read`, {
        method: "PUT",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.isRead).toBe(true);
    expect(data.data.name).toBe("Eve Smith");
    expect(data.data.email).toBe("eve@example.com");
    expect(data.data.message).toBe("Please help me with my account.");
    expect(data.data.id).toBe(contact._id.toString());
  });

  it("should return 404 for non-existent contact", async () => {
    const admin = await createTestUser("mcr-admin2", "mcr-admin2@test.com", UserRole.ADMIN);
    const nonExistentId = new Types.ObjectId().toString();

    const response = await app.handle(
      new Request(`http://localhost/api/v1/contacts/${nonExistentId}/read`, {
        method: "PUT",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Contact not found");
  });

  it("should return 400 for invalid ID", async () => {
    const admin = await createTestUser("mcr-admin3", "mcr-admin3@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/contacts/not-a-valid-id/read", {
        method: "PUT",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid ID");
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("mcr-customer", "mcr-customer@test.com");
    const fakeId = new Types.ObjectId().toString();

    const response = await app.handle(
      new Request(`http://localhost/api/v1/contacts/${fakeId}/read`, {
        method: "PUT",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});
