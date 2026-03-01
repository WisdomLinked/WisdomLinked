import { Elysia, Context, t } from "elysia";
import { getSystemSettings, updateSystemSettings } from "../../models/SystemSettings";
import { logInfo } from "../../middlewares/logger";
import { requireAdmin, AuthUser } from "../../middlewares/auth";

export const updateSettingsController = new Elysia()
  .use(requireAdmin)
  .put("/", async (context) => {
    const { set, user } = context as Context & { user: AuthUser };
    const { registrationEnabled, loginMethods, discordOAuth } = context.body as {
      registrationEnabled?: boolean;
      loginMethods?: { local?: boolean; discord?: boolean };
      discordOAuth?: { clientId?: string; clientSecret?: string; redirectUri?: string };
    };

    try {
      const updates: {
        registrationEnabled?: boolean;
        loginMethods?: { local: boolean; discord: boolean };
        discordOAuth?: { clientId?: string; clientSecret?: string; redirectUri?: string };
      } = {};

      if (registrationEnabled !== undefined) {
        updates.registrationEnabled = registrationEnabled;
      }

      if (loginMethods) {
        // Merge with current settings so a partial loginMethods update
        // (e.g. only sending `local`) doesn't silently drop the other field.
        const current = await getSystemSettings();
        updates.loginMethods = {
          local: loginMethods.local ?? current.loginMethods.local,
          discord: loginMethods.discord ?? current.loginMethods.discord,
        };
      }

      if (discordOAuth) {
        updates.discordOAuth = discordOAuth;
      }

      const settings = await updateSystemSettings(updates);

      await logInfo("System settings updated", {
        adminId: user.userId,
        changes: updates,
      });

      return {
        message: "Settings updated successfully",
        settings: {
          registrationEnabled: settings.registrationEnabled,
          loginMethods: settings.loginMethods,
          discordOAuth: {
            clientId: settings.discordOAuth?.clientId || "",
            redirectUri: settings.discordOAuth?.redirectUri || "",
          },
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        set.status = 500;
        return { error: "Failed to update settings", message: error.message };
      }
      set.status = 500;
      return { error: "Failed to update settings", message: "Unknown error" };
    }
  }, {
    body: t.Object({
      registrationEnabled: t.Optional(t.Boolean()),
      loginMethods: t.Optional(
        t.Object({
          local: t.Optional(t.Boolean()),
          discord: t.Optional(t.Boolean()),
        })
      ),
      discordOAuth: t.Optional(
        t.Object({
          clientId: t.Optional(t.String()),
          clientSecret: t.Optional(t.String()),
          redirectUri: t.Optional(t.String()),
        })
      ),
    }),
  });

