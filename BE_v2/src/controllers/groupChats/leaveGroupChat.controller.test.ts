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
let customerId: string;
let customerToken: string;

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  app = createGroupChatApp();

  const expert = await createTestUser("expert_leave", "expert_leave@test.com", UserRole.EXPERT);
  expertId = expert.id;
  expertToken = expert.token;

  const customer = await createTestUser("customer_leave", "customer_leave@test.com", UserRole.CUSTOMER);
  customerId = customer.id;
  customerToken = customer.token;
});

describe("Leave Group Chat Controller", () => {
  describe("POST /api/v1/group-chats/:groupChatId/leave", () => {
    it("should allow a participant to leave a group chat", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Leave Test Community",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId, customerObjId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/leave`, {
          method: "POST",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Left group chat");

      // Verify the participant was removed
      const updated = await GroupChatModel.findById(groupChat._id);
      const stillIn = updated?.participants.some((p) => p.toString() === customerId);
      expect(stillIn).toBe(false);
    });

    it("should forbid the admin from leaving their own group chat (403)", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "Admin Leave Attempt",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/leave`, {
          method: "POST",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("Admin cannot leave");
    });

    it("should reject leaving when not a participant (400)", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "Not A Member Community",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/leave`, {
          method: "POST",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Not a participant");
    });

    it("should return 401 for an unauthenticated request", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${fakeId}/leave`, {
          method: "POST",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should return 404 for a non-existent group chat", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${fakeId}/leave`, {
          method: "POST",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(404);
    });
  });
});
