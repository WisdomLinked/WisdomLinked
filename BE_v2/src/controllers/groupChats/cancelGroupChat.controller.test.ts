import { beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { Types } from "mongoose";
import { connectToDatabase } from "../../config/database";
import {
  authHeader,
  createTestUser,
  wipeTestDatabase,
} from "../../../test/helpers";
import { GroupChatModel } from "../../models/GroupChat";
import { groupChatRoutes } from "../../routes/v1/groupChats";
import { UserRole } from "../../config/roles";

function createGroupChatApp() {
  return new Elysia().use(groupChatRoutes);
}

type GroupChatApp = ReturnType<typeof createGroupChatApp>;

let app: GroupChatApp;
let expertId: string;
let expertToken: string;
let customerToken: string;
let adminToken: string;

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  app = createGroupChatApp();

  const expert = await createTestUser("expert_cancel", "expert_cancel@test.com", UserRole.EXPERT);
  expertId = expert.id;
  expertToken = expert.token;

  const customer = await createTestUser("customer_cancel", "customer_cancel@test.com", UserRole.CUSTOMER);
  customerToken = customer.token;

  const sysAdmin = await createTestUser("admin_cancel", "admin_cancel@test.com", UserRole.ADMIN);
  adminToken = sysAdmin.token;
});

describe("Cancel Group Chat Controller", () => {
  describe("PUT /api/v1/group-chats/:groupChatId/cancel", () => {
    it("should allow the group admin to cancel a group chat", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "Cancellable Seminar",
        type: "seminar",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/cancel`, {
          method: "PUT",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.groupChat.status).toBe("cancelled");
    });

    it("should allow a system admin to cancel any group chat", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "Admin-Cancel Seminar",
        type: "seminar",
        status: "pending",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/cancel`, {
          method: "PUT",
          headers: authHeader(adminToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.groupChat.status).toBe("cancelled");
    });

    it("should forbid a non-admin customer from cancelling (403)", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "Customer Cannot Cancel",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/cancel`, {
          method: "PUT",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should reject cancelling an already-cancelled group chat (400)", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "Already Cancelled",
        type: "seminar",
        status: "cancelled",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/cancel`, {
          method: "PUT",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("already");
    });

    it("should reject cancelling a completed group chat (400)", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "Completed Seminar",
        type: "seminar",
        status: "completed",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/cancel`, {
          method: "PUT",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should return 401 for an unauthenticated request", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${fakeId}/cancel`, {
          method: "PUT",
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
