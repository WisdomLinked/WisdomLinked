import { Elysia } from "elysia";
import { requireAdmin } from "../../middlewares/auth";
import { getSystemSettings } from "../../models/SystemSettings";

export const getStripeConfigController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const settings = await getSystemSettings();

      return {
        config: {
          publishableKey: settings.stripeConfig?.publishableKey || "",
          secretKey: settings.stripeConfig?.secretKey
            ? "sk_***" + settings.stripeConfig.secretKey.slice(-4)
            : "",
          webhookSecret: settings.stripeConfig?.webhookSecret
            ? "whsec_***" + settings.stripeConfig.webhookSecret.slice(-4)
            : "",
          enabled: settings.stripeConfig?.enabled || false,
        },
        plans: settings.stripePricing?.plans || [],
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to fetch Stripe config", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to fetch Stripe config", message: "Unknown error" };
    }
  });
