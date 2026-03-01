import { Elysia } from "elysia";
import { getSystemSettings } from "../../models/SystemSettings";
import { requireAdmin } from "../../middlewares/auth";

export const getSettingsController = new Elysia()
  .use(requireAdmin)
  .get("/", async (context) => {
    try {
      const settings = await getSystemSettings();

      return {
        settings: {
          registrationEnabled: settings.registrationEnabled,
          loginMethods: settings.loginMethods,
          discordOAuth: {
            clientId: settings.discordOAuth?.clientId || "",
            redirectUri: settings.discordOAuth?.redirectUri || "",
            // Never send the secret to the client
          },
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to get settings", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to get settings", message: "Unknown error" };
    }
  });

