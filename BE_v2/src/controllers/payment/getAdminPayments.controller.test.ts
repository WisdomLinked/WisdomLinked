import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { Types } from "mongoose";
import { connectToDatabase } from "../../config/database";
import { createTestUser, wipeTestDatabase, authHeader } from "../../../test/helpers";
import { paymentRoutes } from "../../routes/v1/payment";
import { UserRole } from "../../config/roles";
import { PaymentModel, PaymentStatus, PaymentType } from "../../models/Payment";

function buildPaymentApp() {
  return new Elysia().use(paymentRoutes);
}

type PaymentApp = ReturnType<typeof buildPaymentApp>;

let app: PaymentApp;

beforeAll(async () => {
  await connectToDatabase();
  await wipeTestDatabase();
  app = buildPaymentApp();
});

beforeEach(async () => {
  await wipeTestDatabase();
});

async function seedPayment(
  userId: string,
  piId: string,
  status: PaymentStatus = PaymentStatus.SUCCEEDED
) {
  return PaymentModel.create({
    userId: new Types.ObjectId(userId),
    stripePaymentIntentId: piId,
    stripeCustomerId: "cus_test_001",
    type: PaymentType.ONE_TIME,
    status,
    amount: 1999,
    currency: "usd",
    description: "Test payment",
    metadata: {},
  });
}

describe("Get Admin Payments Controller", () => {
  describe("GET /api/v1/payment/admin/all", () => {
    it("should reject request without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/admin/all", {
          method: "GET",
        })
      );

      expect(response.status).toBe(401);
    });

    it("should reject non-admin users (customer)", async () => {
      const customer = await createTestUser(
        "adm-pay-cust",
        "adm-pay-cust@test.com",
        UserRole.CUSTOMER
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/admin/all", {
          method: "GET",
          headers: authHeader(customer.token),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should reject expert users", async () => {
      const expert = await createTestUser(
        "adm-pay-expert",
        "adm-pay-expert@test.com",
        UserRole.EXPERT
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/admin/all", {
          method: "GET",
          headers: authHeader(expert.token),
        })
      );

      expect(response.status).toBe(403);
    });

    it("should return empty list when no payments exist", async () => {
      const admin = await createTestUser(
        "adm-pay-admin1",
        "adm-pay-admin1@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/admin/all", {
          method: "GET",
          headers: authHeader(admin.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.payments).toBeDefined();
      expect(Array.isArray(data.payments)).toBe(true);
      expect(data.payments).toHaveLength(0);
      expect(data.total).toBe(0);
      expect(data.page).toBe(1);
      expect(data.totalPages).toBe(0);
    });

    it("should return all payments with correct structure", async () => {
      const admin = await createTestUser(
        "adm-pay-admin2",
        "adm-pay-admin2@test.com",
        UserRole.ADMIN
      );
      const user = await createTestUser("adm-pay-user2", "adm-pay-user2@test.com");

      await seedPayment(user.id, "pi_admin_all_001");
      await seedPayment(user.id, "pi_admin_all_002", PaymentStatus.FAILED);

      const response = await app.handle(
        new Request("http://localhost/api/v1/payment/admin/all", {
          method: "GET",
          headers: authHeader(admin.token),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.payments).toHaveLength(2);
      expect(data.total).toBe(2);

      const payment = data.payments[0];
      expect(payment.id).toBeDefined();
      expect(payment.userId).toBeDefined();
      expect(payment.type).toBeDefined();
      expect(payment.status).toBeDefined();
      expect(payment.amount).toBeDefined();
      expect(payment.currency).toBeDefined();
      expect(payment.stripePaymentIntentId).toBeDefined();
    });

    it("should filter by status", async () => {
      const admin = await createTestUser(
        "adm-pay-admin3",
        "adm-pay-admin3@test.com",
        UserRole.ADMIN
      );
      const user = await createTestUser("adm-pay-user3", "adm-pay-user3@test.com");

      await seedPayment(user.id, "pi_filter_succ_001", PaymentStatus.SUCCEEDED);
      await seedPayment(user.id, "pi_filter_fail_001", PaymentStatus.FAILED);
      await seedPayment(user.id, "pi_filter_succ_002", PaymentStatus.SUCCEEDED);

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/payment/admin/all?status=${PaymentStatus.SUCCEEDED}`,
          {
            method: "GET",
            headers: authHeader(admin.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.payments).toHaveLength(2);
      expect(data.payments.every((p: { status: string }) => p.status === PaymentStatus.SUCCEEDED)).toBe(true);
    });

    it("should filter by userId", async () => {
      const admin = await createTestUser(
        "adm-pay-admin4",
        "adm-pay-admin4@test.com",
        UserRole.ADMIN
      );
      const user1 = await createTestUser("adm-pay-user4a", "adm-pay-user4a@test.com");
      const user2 = await createTestUser("adm-pay-user4b", "adm-pay-user4b@test.com");

      await seedPayment(user1.id, "pi_uid_filter_001");
      await seedPayment(user2.id, "pi_uid_filter_002");
      await seedPayment(user1.id, "pi_uid_filter_003");

      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/payment/admin/all?userId=${user1.id}`,
          {
            method: "GET",
            headers: authHeader(admin.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.payments).toHaveLength(2);
      expect(data.payments.every((p: { userId: string }) => p.userId === user1.id)).toBe(true);
    });

    it("should paginate results correctly", async () => {
      const admin = await createTestUser(
        "adm-pay-admin5",
        "adm-pay-admin5@test.com",
        UserRole.ADMIN
      );
      const user = await createTestUser("adm-pay-user5", "adm-pay-user5@test.com");

      // Seed 5 payments
      for (let i = 0; i < 5; i++) {
        await seedPayment(user.id, `pi_page_test_00${i}`);
      }

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/payment/admin/all?page=1&limit=2",
          {
            method: "GET",
            headers: authHeader(admin.token),
          }
        )
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.payments).toHaveLength(2);
      expect(data.total).toBe(5);
      expect(data.page).toBe(1);
      expect(data.totalPages).toBe(3);
    });

    it("should return 400 for invalid status value", async () => {
      const admin = await createTestUser(
        "adm-pay-admin6",
        "adm-pay-admin6@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/payment/admin/all?status=invalid_status",
          {
            method: "GET",
            headers: authHeader(admin.token),
          }
        )
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Invalid status");
    });

    it("should return 400 for invalid userId format", async () => {
      const admin = await createTestUser(
        "adm-pay-admin7",
        "adm-pay-admin7@test.com",
        UserRole.ADMIN
      );

      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/payment/admin/all?userId=not-a-valid-object-id",
          {
            method: "GET",
            headers: authHeader(admin.token),
          }
        )
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Invalid userId");
    });
  });
});
