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

  const expert = await createTestUser("expert_approve", "expert_approve@test.com", UserRole.EXPERT);
  expertId = expert.id;
  expertToken = expert.token;

  const customer = await createTestUser("customer_approve", "customer_approve@test.com", UserRole.CUSTOMER);
  customerId = customer.id;
  customerToken = customer.token;
});

describe("Approve Appointment Controller", () => {
  describe("PUT /api/v1/group-chats/:groupChatId/appointment/:appointmentId/approve", () => {
    it("should allow the group admin to approve an appointment", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Approval Test Session",
        type: "individual",
        status: "pending",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const appointment = await PendingAppointmentToGroupModel.create({
        userId: customerObjId,
        groupChatId: groupChat._id,
        status: "pending",
      });

      const url = `http://localhost/api/v1/group-chats/${groupChat._id.toString()}/appointment/${appointment._id.toString()}/approve`;

      const response = await app.handle(
        new Request(url, {
          method: "PUT",
          headers: authHeader(expertToken),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Appointment approved");
      expect(data.groupChat).toBeDefined();
    });

    it("should add the requesting user to participants after approval", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Participant Add Test",
        type: "individual",
        status: "pending",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const appointment = await PendingAppointmentToGroupModel.create({
        userId: customerObjId,
        groupChatId: groupChat._id,
        status: "pending",
      });

      const url = `http://localhost/api/v1/group-chats/${groupChat._id.toString()}/appointment/${appointment._id.toString()}/approve`;

      await app.handle(
        new Request(url, {
          method: "PUT",
          headers: authHeader(expertToken),
        })
      );

      // Verify customer was added to participants
      const updated = await GroupChatModel.findById(groupChat._id);
      const isNowParticipant = updated?.participants.some(
        (p) => p.toString() === customerId
      );
      expect(isNowParticipant).toBe(true);
    });

    it("should activate the group chat upon first approval", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Activation Test Session",
        type: "individual",
        status: "pending",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const appointment = await PendingAppointmentToGroupModel.create({
        userId: customerObjId,
        groupChatId: groupChat._id,
        status: "pending",
      });

      const url = `http://localhost/api/v1/group-chats/${groupChat._id.toString()}/appointment/${appointment._id.toString()}/approve`;

      await app.handle(
        new Request(url, {
          method: "PUT",
          headers: authHeader(expertToken),
        })
      );

      const updated = await GroupChatModel.findById(groupChat._id);
      expect(updated?.status).toBe("active");
    });

    it("should delete the appointment record after approval", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Appointment Delete Test",
        type: "individual",
        status: "pending",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const appointment = await PendingAppointmentToGroupModel.create({
        userId: customerObjId,
        groupChatId: groupChat._id,
        status: "pending",
      });

      const url = `http://localhost/api/v1/group-chats/${groupChat._id.toString()}/appointment/${appointment._id.toString()}/approve`;

      await app.handle(
        new Request(url, {
          method: "PUT",
          headers: authHeader(expertToken),
        })
      );

      // Verify appointment was deleted
      const deletedAppointment = await PendingAppointmentToGroupModel.findById(appointment._id);
      expect(deletedAppointment).toBeNull();
    });

    it("should forbid a customer from approving an appointment (403)", async () => {
      const adminId = new Types.ObjectId(expertId);
      const customerObjId = new Types.ObjectId(customerId);

      const groupChat = await GroupChatModel.create({
        name: "Customer Cannot Approve",
        type: "individual",
        status: "pending",
        admin: adminId,
        createdBy: adminId,
        participants: [adminId],
        isOpenToAll: false,
      });

      const appointment = await PendingAppointmentToGroupModel.create({
        userId: customerObjId,
        groupChatId: groupChat._id,
        status: "pending",
      });

      const url = `http://localhost/api/v1/group-chats/${groupChat._id.toString()}/appointment/${appointment._id.toString()}/approve`;

      const response = await app.handle(
        new Request(url, {
          method: "PUT",
          headers: authHeader(customerToken),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should return 401 for an unauthenticated request", async () => {
      const fakeGroupId = new Types.ObjectId().toString();
      const fakeApptId = new Types.ObjectId().toString();

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/group-chats/${fakeGroupId}/appointment/${fakeApptId}/approve`,
          {
            method: "PUT",
          }
        )
      );

      expect(response.status).toBe(401);
    });
  });
});
