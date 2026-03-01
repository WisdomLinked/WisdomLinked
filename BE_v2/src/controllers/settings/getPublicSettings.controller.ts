import { Elysia } from "elysia";
import { getSystemSettings } from "../../models/SystemSettings";

export const getPublicSettingsController = new Elysia().get("/", async (context) => {
  try {
    const settings = await getSystemSettings();

    // Return only public settings (no secrets)
    return {
      registrationEnabled: settings.registrationEnabled,
      loginMethods: {
        local: settings.loginMethods.local,
        discord: settings.loginMethods.discord,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      context.set.status = 500;
      return { error: "Failed to fetch public settings", message: error.message };
    }
    context.set.status = 500;
    return { error: "Failed to fetch public settings", message: "Unknown error" };
  }
});
