import { Elysia } from "elysia";
import {
  createCheckoutSessionController,
  handleStripeWebhookController,
  getUserSubscriptionController,
  cancelSubscriptionController,
  getUserPaymentsController,
  getPricingPlansController,
  getStripeConfigController,
  updateStripeConfigController,
  updatePricingPlansController,
  refundPaymentController,
  createEventPaymentController,
  getAdminPaymentsController,
} from "../../controllers/payment";

export const paymentRoutes = new Elysia({ prefix: "/api/v1/payment" })
  // Public routes
  .use(new Elysia({ prefix: "/pricing" }).use(getPricingPlansController))
  .use(new Elysia({ prefix: "/webhook" }).use(handleStripeWebhookController))

  // Authenticated routes
  .use(new Elysia({ prefix: "/checkout" }).use(createCheckoutSessionController))
  .use(new Elysia({ prefix: "/subscription" })
    .use(getUserSubscriptionController)
    .use(new Elysia({ prefix: "/cancel" }).use(cancelSubscriptionController))
  )
  .use(new Elysia({ prefix: "/history" }).use(getUserPaymentsController))
  .use(new Elysia({ prefix: "/event" }).use(createEventPaymentController))

  // Admin routes
  .use(new Elysia({ prefix: "/config" })
    .use(getStripeConfigController)
    .use(updateStripeConfigController)
  )
  .use(new Elysia({ prefix: "/plans" }).use(updatePricingPlansController))
  .use(new Elysia({ prefix: "/refund" }).use(refundPaymentController))
  .use(new Elysia({ prefix: "/admin/all" }).use(getAdminPaymentsController));
