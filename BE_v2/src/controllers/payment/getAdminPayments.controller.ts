import { Elysia, t } from "elysia";
import { Types } from "mongoose";
import { requireAdmin } from "../../middlewares/auth";
import { PaymentModel, PaymentStatus } from "../../models/Payment";

// Pure type guard for PaymentStatus validation
function isPaymentStatus(value: string): value is PaymentStatus {
  return (Object.values(PaymentStatus) as string[]).includes(value);
}

export const getAdminPaymentsController = new Elysia()
  .use(requireAdmin)
  .get(
    "/",
    async (context) => {
      const query = context.query as {
        page?: string;
        limit?: string;
        status?: string;
        userId?: string;
      };

      try {
        const page = Math.max(1, parseInt(query.page ?? "1", 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "20", 10)));
        const skip = (page - 1) * limit;

        const filter: { status?: PaymentStatus; userId?: Types.ObjectId } = {};

        if (query.status !== undefined) {
          if (!isPaymentStatus(query.status)) {
            context.set.status = 400;
            return { error: "Invalid status value" };
          }
          filter.status = query.status;
        }

        if (query.userId !== undefined) {
          if (!Types.ObjectId.isValid(query.userId)) {
            context.set.status = 400;
            return { error: "Invalid userId format" };
          }
          filter.userId = new Types.ObjectId(query.userId);
        }

        const [payments, total] = await Promise.all([
          PaymentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
          PaymentModel.countDocuments(filter),
        ]);

        return {
          payments: payments.map((p) => ({
            id: p._id.toString(),
            userId: p.userId.toString(),
            type: p.type,
            status: p.status,
            amount: p.amount,
            currency: p.currency,
            description: p.description,
            stripePaymentIntentId: p.stripePaymentIntentId,
            createdAt: p.createdAt,
          })),
          total,
          page,
          totalPages: Math.ceil(total / limit),
        };
      } catch (error) {
        if (error instanceof Error) {
          context.set.status = 500;
          return { error: "Failed to fetch payments", message: error.message };
        }
        context.set.status = 500;
        return { error: "Failed to fetch payments", message: "Unknown error" };
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        status: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
    }
  );
