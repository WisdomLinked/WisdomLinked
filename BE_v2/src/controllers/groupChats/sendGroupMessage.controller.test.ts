import { beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { Types } from "mongoose";
import { connectToDatabase } from "../../config/database";
import {
  createTestUser,
  jsonHeaders,
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
let outsiderToken: string;

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  app = createGroupChatApp();

  const expert = await createTestUser("expert_msg", "expert_msg@test.com", UserRole.EXPERT);
  expertId = expert.id;

  const customer = await createTestUser("customer_msg", "customer_msg@test.com", UserRole.CUSTOMER);
  customerId = customer.id;
  customerToken = customer.token;

  const outsider = await createTestUser("outsider_msg", "outsider_msg@test.com", UserRole.CUSTOMER);
  outsiderToken = outsider.token;
});

describe("Send Group Message Controller", () => {
  describe("POST /api/v1/group-chats/:groupChatId/messages", () => {
    it("should allow a participant to send a text message", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Message Test Community",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId, customerObjId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/messages`, {
          method: "POST",
          headers: jsonHeaders(customerToken),
          body: JSON.stringify({ content: "Hello, group!", type: "text" }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("message");
      expect(data.message.content).toBe("Hello, group!");
      expect(data.message.type).toBe("text");
    });

    it("should default message type to text when not specified", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Default Type Community",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId, customerObjId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/messages`, {
          method: "POST",
          headers: jsonHeaders(customerToken),
          body: JSON.stringify({ content: "No type specified" }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message.type).toBe("text");
    });

    it("should allow sending a file message with fileUrl", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "File Message Community",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId, customerObjId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/messages`, {
          method: "POST",
          headers: jsonHeaders(customerToken),
          body: JSON.stringify({
            content: "Check this file",
            type: "file",
            fileUrl: "https://example.com/file.pdf",
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message.type).toBe("file");
      expect(data.message.fileUrl).toBe("https://example.com/file.pdf");
    });

    it("should forbid non-participants from sending messages (403)", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "Non-Participant Message Test",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/messages`, {
          method: "POST",
          headers: jsonHeaders(outsiderToken),
          body: JSON.stringify({ content: "I should not be able to send this" }),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should reject empty content (422)", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Empty Content Test",
        type: "community",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId, customerObjId],
        isOpenToAll: true,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}/messages`, {
          method: "POST",
          headers: jsonHeaders(customerToken),
          body: JSON.stringify({ content: "" }),
        })
      );

      expect(response.status).toBe(422);
    });

    it("should return 401 for an unauthenticated request", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${fakeId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Unauthorized" }),
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
