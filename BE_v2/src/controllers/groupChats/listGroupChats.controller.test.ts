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
let customerToken: string;
let customerId: string;

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  app = createGroupChatApp();

  const expert = await createTestUser("expert_list", "expert_list@test.com", UserRole.EXPERT);
  expertToken = expert.token;
  expertId = expert.id;

  const customer = await createTestUser("customer_list", "customer_list@test.com", UserRole.CUSTOMER);
  customerToken = customer.token;
  customerId = customer.id;

  // Seed a variety of group chats
  const adminId = new Types.ObjectId(expertId);
  const customerObjId = new Types.ObjectId(customerId);

  await GroupChatModel.create([
    {
      name: "Seminar A",
      type: "seminar",
      status: "active",
      admin: adminId,
      createdBy: adminId,
      participants: [adminId],
      isOpenToAll: false,
    },
    {
      name: "Seminar B",
      type: "seminar",
      status: "pending",
      admin: adminId,
      createdBy: adminId,
      participants: [adminId],
      isOpenToAll: false,
    },
    {
      name: "Community Open",
      type: "community",
      status: "active",
      admin: customerObjId,
      createdBy: customerObjId,
      participants: [customerObjId],
      isOpenToAll: true,
    },
    {
      name: "Individual Chat",
      type: "individual",
      status: "pending",
      admin: adminId,
      createdBy: adminId,
      participants: [adminId],
      isOpenToAll: false,
    },
  ]);
});

describe("List Group Chats Controller", () => {
  describe("GET /api/v1/group-chats", () => {
    it("should return all group chats (paginated)", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats", {
          method: "GET",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("groupChats");
      expect(data).toHaveProperty("total");
      expect(data).toHaveProperty("page");
      expect(data).toHaveProperty("totalPages");
      expect(data.total).toBe(4);
      expect(data.groupChats).toHaveLength(4);
    });

    it("should filter by type=seminar", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats?type=seminar", {
          method: "GET",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.total).toBe(2);
      data.groupChats.forEach((gc: { type: string }) => {
        expect(gc.type).toBe("seminar");
      });
    });

    it("should filter by status=active", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats?status=active", {
          method: "GET",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.total).toBe(2);
    });

    it("should filter mine=true for expert's own groups", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats?mine=true", {
          method: "GET",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      // Expert is participant in 3 groups (seminar A, seminar B, individual)
      expect(data.total).toBe(3);
    });

    it("should filter mine=true for customer's own groups", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats?mine=true", {
          method: "GET",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      // Customer is participant in 1 group (Community Open)
      expect(data.total).toBe(1);
    });

    it("should paginate correctly with page=1&limit=2", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats?page=1&limit=2", {
          method: "GET",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.groupChats).toHaveLength(2);
      expect(data.totalPages).toBe(2);
      expect(data.page).toBe(1);
    });

    it("should return 401 for an unauthenticated request", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/group-chats", {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
