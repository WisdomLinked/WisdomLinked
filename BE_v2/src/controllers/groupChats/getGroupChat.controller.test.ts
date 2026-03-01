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
let expertToken: string;
let expertId: string;

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  app = createGroupChatApp();

  const expert = await createTestUser("expert_get", "expert_get@test.com", UserRole.EXPERT);
  expertToken = expert.token;
  expertId = expert.id;
});

describe("Get Group Chat Controller", () => {
  describe("GET /api/v1/group-chats/:groupChatId", () => {
    it("should return a group chat with populated fields", async () => {
      const adminId = new Types.ObjectId(expertId);
      const groupChat = await GroupChatModel.create({
        name: "Fetch Test Seminar",
        type: "seminar",
        status: "pending",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${groupChat._id.toString()}`, {
          method: "GET",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("groupChat");
      expect(data.groupChat._id.toString()).toBe(groupChat._id.toString());
      expect(data.groupChat.name).toBe("Fetch Test Seminar");
    });

    it("should return 404 for a non-existent group chat", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${fakeId}`, {
          method: "GET",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("not found");
    });

    it("should return 400 for an invalid ObjectId", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats/not-a-valid-id", {
          method: "GET",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should return 401 for an unauthenticated request", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${fakeId}`, {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
