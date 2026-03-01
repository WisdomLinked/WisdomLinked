import { Elysia } from "elysia";
import { getSystemSettings } from "../../models/SystemSettings";

export const getPricingPlansController = new Elysia().get("/", async (context) => {
  try {
    const settings = await getSystemSettings();

    const activePlans = settings.stripePricing.plans.filter((plan) => plan.isActive);

    return {
      plans: activePlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        type: plan.type,
        currency: plan.currency,
        amount: plan.amount,
        interval: plan.interval,
        features: plan.features,
      })),
    };
  } catch (error) {
    if (error instanceof Error) {
      context.set.status = 500;
      return { error: "Failed to fetch pricing plans", message: error.message };
    }
    context.set.status = 500;
    return { error: "Failed to fetch pricing plans", message: "Unknown error" };
  }
});
