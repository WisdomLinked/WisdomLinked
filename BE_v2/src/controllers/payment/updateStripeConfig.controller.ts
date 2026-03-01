import { Elysia, t } from "elysia";
import { requireAdmin } from "../../middlewares/auth";
import { updateSystemSettings } from "../../models/SystemSettings";

export const updateStripeConfigController = new Elysia()
  .use(requireAdmin)
  .put(
    "/",
    async (context) => {
      const body = context.body as {
        publishableKey?: string;
        secretKey?: string;
        webhookSecret?: string;
        enabled: boolean;
      };

      try {
        const updates: {
          stripeConfig: {
            enabled: boolean;
            publishableKey?: string;
            secretKey?: string;
            webhookSecret?: string;
          };
        } = {
          stripeConfig: {
            enabled: body.enabled,
          },
        };

        if (body.publishableKey) {
          updates.stripeConfig.publishableKey = body.publishableKey;
        }
        if (body.secretKey) {
          updates.stripeConfig.secretKey = body.secretKey;
        }
        if (body.webhookSecret) {
          updates.stripeConfig.webhookSecret = body.webhookSecret;
        }

        await updateSystemSettings(updates);

        return { message: "Stripe configuration updated successfully" };
      } catch (error) {
        if (error instanceof Error) {
          context.set.status = 500;
          return { error: "Failed to update Stripe config", message: error.message };
        }
        context.set.status = 500;
        return { error: "Failed to update Stripe config", message: "Unknown error" };
      }
    },
    {
      body: t.Object({
        publishableKey: t.Optional(t.String()),
        secretKey: t.Optional(t.String()),
        webhookSecret: t.Optional(t.String()),
        enabled: t.Boolean(),
      }),
    }
  );
