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
let customerId: string;
let customerToken: string;

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  app = createGroupChatApp();

  const expert = await createTestUser("expert_join", "expert_join@test.com", UserRole.EXPERT);
  expertId = expert.id;

  const customer = await createTestUser("customer_join", "customer_join@test.com", UserRole.CUSTOMER);
  customerId = customer.id;
  customerToken = customer.token;
});

describe("Join Group Chat Controller", () => {
  describe("POST /api/v1/group-chats/:groupChatId/join", () => {
    it("should allow a user to join an open community group chat", async () => {
      const adminId = new Types.ObjectId(expertId);
      const groupChat = await GroupChatModel.create({
        name: "Open Community",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/join`, {
          method: "POST",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.groupChat).toBeDefined();
      const participantIds = data.groupChat.participants.map((p: { _id: string } | string) =>
        typeof p === "string" ? p : p._id
      );
      expect(participantIds).toContain(customerId);
    });

    it("should allow a user to join a free seminar (no price)", async () => {
      const adminId = new Types.ObjectId(expertId);
      const groupChat = await GroupChatModel.create({
        name: "Free Seminar",
        type: "seminar",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
        price: 0,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/join`, {
          method: "POST",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(200);
    });

    it("should reject joining a paid seminar without payment (402)", async () => {
      const adminId = new Types.ObjectId(expertId);
      const groupChat = await GroupChatModel.create({
        name: "Paid Seminar",
        type: "seminar",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
        price: 99,
        paidBy: [],
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/join`, {
          method: "POST",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(402);
    });

    it("should allow joining a paid seminar when payment is recorded", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);
      const groupChat = await GroupChatModel.create({
        name: "Paid Seminar With Payment",
        type: "seminar",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
        price: 99,
        paidBy: [customerObjId],
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/join`, {
          method: "POST",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(200);
    });

    it("should reject joining an individual group chat (400)", async () => {
      const adminId = new Types.ObjectId(expertId);
      const groupChat = await GroupChatModel.create({
        name: "Individual Chat",
        type: "individual",
        status: "pending",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/join`, {
          method: "POST",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("appointment");
    });

    it("should reject joining an invite-only community (403)", async () => {
      const adminId = new Types.ObjectId(expertId);
      const groupChat = await GroupChatModel.create({
        name: "Private Community",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/join`, {
          method: "POST",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should reject joining a cancelled group chat (400)", async () => {
      const adminId = new Types.ObjectId(expertId);
      const groupChat = await GroupChatModel.create({
        name: "Cancelled Community",
        type: "community",
        status: "cancelled",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/join`, {
          method: "POST",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should reject joining when already a participant (409)", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);
      const groupChat = await GroupChatModel.create({
        name: "Already Joined Community",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId, customerObjId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/join`, {
          method: "POST",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(409);
    });

    it("should return 401 for an unauthenticated request", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${fakeId}/join`, {
          method: "POST",
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
