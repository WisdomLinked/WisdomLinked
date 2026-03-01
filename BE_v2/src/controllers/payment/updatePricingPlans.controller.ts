import { Elysia, t } from "elysia";
import { requireAdmin } from "../../middlewares/auth";
import { updateSystemSettings, StripePricingPlan } from "../../models/SystemSettings";

export const updatePricingPlansController = new Elysia()
  .use(requireAdmin)
  .put(
    "/",
    async (context) => {
      const body = context.body as { plans: StripePricingPlan[] };

      try {
        await updateSystemSettings({
          stripePricing: {
            plans: body.plans,
          },
        });

        return { message: "Pricing plans updated successfully" };
      } catch (error) {
        if (error instanceof Error) {
          context.set.status = 500;
          return { error: "Failed to update pricing plans", message: error.message };
        }
        context.set.status = 500;
        return { error: "Failed to update pricing plans", message: "Unknown error" };
      }
    },
    {
      body: t.Object({
        plans: t.Array(
          t.Object({
            id: t.String(),
            name: t.String(),
            description: t.String(),
            stripePriceId: t.String(),
            type: t.Union([t.Literal("subscription"), t.Literal("one_time")]),
            currency: t.String(),
            amount: t.Number(),
            interval: t.Optional(t.Union([t.Literal("month"), t.Literal("year")])),
            features: t.Array(t.String()),
            isActive: t.Boolean(),
            createdAt: t.Date(),
          })
        ),
      }),
    }
  );
