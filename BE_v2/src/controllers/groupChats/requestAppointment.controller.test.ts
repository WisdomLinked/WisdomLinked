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
import { PendingAppointmentToGroupModel } from "../../models/PendingAppointmentToGroup";
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

  const expert = await createTestUser("expert_appt", "expert_appt@test.com", UserRole.EXPERT);
  expertId = expert.id;
  expertToken = expert.token;

  const customer = await createTestUser("customer_appt", "customer_appt@test.com", UserRole.CUSTOMER);
  customerId = customer.id;
  customerToken = customer.token;
});

describe("Request Appointment Controller", () => {
  describe("POST /api/v1/group-chats/:groupChatId/appointment", () => {
    it("should allow a customer to request an appointment for an individual group chat", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "1-on-1 Session",
        type: "individual",
        status: "pending",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/group-chats/${groupChat._id.toString()}/appointment`,
          {
            method: "POST",
            headers: authHeader(customerToken),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("appointment");
      expect(data.appointment.status).toBe("pending");
      expect(data.appointment.userId.toString()).toBe(customerId);
    });

    it("should reject a non-customer (expert) requesting an appointment (403)", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "Expert Cannot Request",
        type: "individual",
        status: "pending",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/group-chats/${groupChat._id.toString()}/appointment`,
          {
            method: "POST",
            headers: authHeader(expertToken),
          }
        )
      );

      expect(response.status).toBe(403);
    });

    it("should reject requesting an appointment for a non-individual group chat (400)", async () => {
      const adminId = new Types.ObjectId(expertId);

      const groupChat = await GroupChatModel.create({
        name: "Seminar No Appointment",
        type: "seminar",
        status: "active",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/group-chats/${groupChat._id.toString()}/appointment`,
          {
            method: "POST",
            headers: authHeader(customerToken),
          }
        )
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("individual");
    });

    it("should reject a duplicate pending appointment (409)", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Duplicate Appointment Test",
        type: "individual",
        status: "pending",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      // Pre-seed an existing appointment
      await PendingAppointmentToGroupModel.create({
        userId: customerObjId,
        groupChatId: groupChat._id,
        status: "pending",
      });

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/group-chats/${groupChat._id.toString()}/appointment`,
          {
            method: "POST",
            headers: authHeader(customerToken),
          }
        )
      );

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain("already exists");
    });

    it("should return 401 for an unauthenticated request", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await app.handle(
        new Request(`http://localhost/api/v1/group-chats/${fakeId}/appointment`, {
          method: "POST",
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
