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
import { MessageModel } from "../../models/Message";
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
let outsiderToken: string;

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  app = createGroupChatApp();

  const expert = await createTestUser("expert_getmsg", "expert_getmsg@test.com", UserRole.EXPERT);
  expertId = expert.id;

  const customer = await createTestUser("customer_getmsg", "customer_getmsg@test.com", UserRole.CUSTOMER);
  customerId = customer.id;
  customerToken = customer.token;

  const outsider = await createTestUser("outsider_getmsg", "outsider_getmsg@test.com", UserRole.CUSTOMER);
  outsiderToken = outsider.token;
});

describe("Get Group Messages Controller", () => {
  describe("GET /api/v1/group-chats/:groupChatId/messages", () => {
    it("should return paginated messages for a participant", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Get Messages Test",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId, customerObjId],
        isOpenToAll: true,
      });

      // Seed 5 messages
      await MessageModel.create([
        { author: adminId, content: "Message 1", type: "text", groupChatId: groupChat._id, readBy: [adminId] },
        { author: adminId, content: "Message 2", type: "text", groupChatId: groupChat._id, readBy: [adminId] },
        { author: customerObjId, content: "Message 3", type: "text", groupChatId: groupChat._id, readBy: [customerObjId] },
        { author: adminId, content: "Message 4", type: "text", groupChatId: groupChat._id, readBy: [adminId] },
        { author: customerObjId, content: "Message 5", type: "text", groupChatId: groupChat._id, readBy: [customerObjId] },
      ]);

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/messages`, {
          method: "GET",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("messages");
      expect(data).toHaveProperty("total");
      expect(data).toHaveProperty("page");
      expect(data).toHaveProperty("totalPages");
      expect(data.total).toBe(5);
      expect(data.messages).toHaveLength(5);
    });

    it("should apply pagination with page and limit params", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Pagination Test Community",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId, customerObjId],
        isOpenToAll: true,
      });

      // Seed 6 messages
      for (let i = 0; i < 6; i++) {
        await MessageModel.create({
          author: adminId,
          content: `Page message ${i + 1}`,
          type: "text",
          groupChatId: groupChat._id,
          readBy: [adminId],
        });
      }

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/group-chats/${groupChat._id.toString()}/messages?page=1&limit=3`,
          {
            method: "GET",
            headers: authHeader(customerToken),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.messages).toHaveLength(3);
      expect(data.totalPages).toBe(2);
      expect(data.page).toBe(1);
    });

    it("should forbid non-participants from reading messages (403)", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "Non-Participant Read Test",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/messages`, {
          method: "GET",
          headers: authHeader(outsiderToken),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should return 404 for a non-existent group chat", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${fakeId}/messages`, {
          method: "GET",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(404);
    });

    it("should return 401 for an unauthenticated request", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${fakeId}/messages`, {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should return an empty messages array for a group chat with no messages", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Empty Messages Community",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId, customerObjId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/messages`, {
          method: "GET",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.messages).toHaveLength(0);
      expect(data.total).toBe(0);
      expect(data.totalPages).toBe(0);
    });
  });
});
