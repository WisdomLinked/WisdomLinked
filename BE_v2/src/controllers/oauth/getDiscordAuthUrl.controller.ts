import { Elysia } from "elysia";
import { getSystemSettings } from "../../models/SystemSettings";

export const getDiscordAuthUrlController = new Elysia()
  .get("/", async (context) => {
    try {
      const settings = await getSystemSettings();

      if (!settings.loginMethods.discord) {
        context.set.status = 403;
        return { error: "Discord authentication is disabled" };
      }

      if (!settings.discordOAuth?.clientId || !settings.discordOAuth?.redirectUri) {
        context.set.status = 500;
        return { error: "Discord OAuth not configured" };
      }

      const params = new URLSearchParams({
        client_id: settings.discordOAuth.clientId,
        redirect_uri: settings.discordOAuth.redirectUri,
        response_type: "code",
        scope: "identify email guilds",
      });

      const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

      return { authUrl };
    } catch (error) {
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to generate Discord auth URL", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to generate Discord auth URL", message: "Unknown error" };
    }
  });

