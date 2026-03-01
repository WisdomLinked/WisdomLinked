import { Elysia } from "elysia";
import { requireAuth } from "../../middlewares/auth";
import { PaymentModel } from "../../models/Payment";

export const getUserPaymentsController = new Elysia()
  .use(requireAuth)
  .get("/", async (context) => {
    const user = context.user;

    if (!user) {
      context.set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      const payments = await PaymentModel.find({ userId: user.userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      return {
        payments: payments.map((p) => ({
          id: p._id.toString(),
          type: p.type,
          status: p.status,
          amount: p.amount,
          currency: p.currency,
          description: p.description,
          createdAt: p.createdAt,
        })),
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to fetch payments", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to fetch payments", message: "Unknown error" };
    }
  });
