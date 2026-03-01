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

describe("Delete Contact Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should delete a contact as admin", async () => {
    const admin = await createTestUser("dco-admin", "dco-admin@test.com", UserRole.ADMIN);
    const contact = await ContactedUsModel.create({
      name: "John Doe",
      email: "john@example.com",
      message: "I have a question about the platform.",
      isRead: false,
    });

    const response = await app.handle(
      new Request(`http://localhost/api/v1/contacts/${contact._id.toString()}`, {
        method: "DELETE",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("Contact deleted successfully");
    const deleted = await ContactedUsModel.findById(contact._id);
    expect(deleted).toBeNull();
  });

  it("should return 404 for non-existent contact", async () => {
    const admin = await createTestUser("dco-admin2", "dco-admin2@test.com", UserRole.ADMIN);
    const nonExistentId = new Types.ObjectId().toString();

    const response = await app.handle(
      new Request(`http://localhost/api/v1/contacts/${nonExistentId}`, {
        method: "DELETE",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Contact not found");
  });

  it("should return 400 for invalid ID", async () => {
    const admin = await createTestUser("dco-admin3", "dco-admin3@test.com", UserRole.ADMIN);

    const response = await app.handle(
      new Request("http://localhost/api/v1/contacts/not-a-valid-id", {
        method: "DELETE",
        headers: authHeader(admin.token),
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid ID");
  });

  it("should reject non-admin users", async () => {
    const customer = await createTestUser("dco-customer", "dco-customer@test.com");
    const fakeId = new Types.ObjectId().toString();

    const response = await app.handle(
      new Request(`http://localhost/api/v1/contacts/${fakeId}`, {
        method: "DELETE",
        headers: authHeader(customer.token),
      })
    );

    expect(response.status).toBe(403);
  });
});
