import { Elysia, t } from "elysia";
import { requireAdmin } from "../../middlewares/auth";
import { PaymentModel, PaymentStatus } from "../../models/Payment";
import { UserModel } from "../../models/User";
import { refundPayment } from "../../services/payment";
import { sendPaymentConfirmation } from "../../services/email";

export const refundPaymentController = new Elysia()
  .use(requireAdmin)
  .post(
    "/",
    async (context) => {
      const body = context.body as { paymentIntentId: string; amount?: number; reason?: string };
      const { paymentIntentId, amount, reason } = body;

      try {
        const payment = await PaymentModel.findOne({ stripePaymentIntentId: paymentIntentId });
        if (!payment) {
          context.set.status = 404;
          return { error: "Payment not found" };
        }

        // Issue refund via Stripe service
        const refund = await refundPayment(paymentIntentId, amount);

        // Update payment record in DB
        payment.status = PaymentStatus.REFUNDED;
        payment.refundedAmount = refund.amount;
        payment.refundedAt = new Date();
        await payment.save();

        // Send email confirmation (fire-and-forget — email failure must not crash the request)
        const user = await UserModel.findById(payment.userId).lean();
        if (user?.email) {
          await sendPaymentConfirmation(user.email, {
            amount: refund.amount,
            currency: refund.currency,
            description: reason ?? "Refund processed",
          });
        }

        return {
          refund: {
            id: refund.id,
            amount: refund.amount,
            status: refund.status,
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          context.set.status = 500;
          return { error: "Failed to process refund", message: error.message };
        }
        context.set.status = 500;
        return { error: "Failed to process refund", message: "Unknown error" };
      }
    },
    {
      body: t.Object({
        paymentIntentId: t.String(),
        amount: t.Optional(t.Number()),
        reason: t.Optional(t.String()),
      }),
    }
  );
