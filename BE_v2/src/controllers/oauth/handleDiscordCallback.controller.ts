import { Elysia } from "elysia";
import { UserModel, AuthMethod } from "../../models/User";
import { getSystemSettings } from "../../models/SystemSettings";
import { generateToken } from "../../utils/jwt";
import { logInfo } from "../../middlewares/logger";
import {
  createSession,
  parseDiscordTokenData,
  parseDiscordUser,
  parseDiscordGuilds,
  getDiscordAccountCreatedAt,
  getAccountAgeDays,
} from "./shared";

export const handleDiscordCallbackController = new Elysia()
  .get("/", async (context) => {
    try {
      const { code } = context.query;

      if (!code) {
        context.set.status = 400;
        return { error: "Authorization code not provided" };
      }

      const settings = await getSystemSettings();

      if (!settings.loginMethods.discord) {
        context.set.status = 403;
        return { error: "Discord authentication is disabled" };
      }

      if (!settings.discordOAuth?.clientId || !settings.discordOAuth?.clientSecret || !settings.discordOAuth?.redirectUri) {
        context.set.status = 500;
        return { error: "Discord OAuth not configured" };
      }

      // Exchange code for access token
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: settings.discordOAuth.clientId,
          client_secret: settings.discordOAuth.clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: settings.discordOAuth.redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("Discord token exchange failed:", errorData);
        context.set.status = 400;
        return { error: "Failed to exchange code for token", details: errorData };
      }

      const tokenPayload: unknown = await tokenResponse.json();
      const tokenData = parseDiscordTokenData(tokenPayload);
      if (!tokenData) {
        context.set.status = 400;
        return { error: "Invalid token response from Discord" };
      }

      // Get user info from Discord
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        context.set.status = 400;
        return { error: "Failed to fetch user info from Discord" };
      }

      const userPayload: unknown = await userResponse.json();
      const discordUser = parseDiscordUser(userPayload);
      if (!discordUser) {
        context.set.status = 400;
        return { error: "Invalid user payload from Discord" };
      }

      // Fetch guilds list for anti-bot signals
      const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!guildsResponse.ok) {
        const guildError = await guildsResponse.text();
        context.set.status = 400;
        return { error: "Failed to fetch guilds from Discord", details: guildError };
      }

      const guildsPayload: unknown = await guildsResponse.json();
      const discordGuilds = parseDiscordGuilds(guildsPayload);
      if (!discordGuilds) {
        context.set.status = 400;
        return { error: "Invalid guild payload from Discord" };
      }

      const accountCreatedAt = getDiscordAccountCreatedAt(discordUser.id);
      const accountAgeDays = accountCreatedAt ? getAccountAgeDays(accountCreatedAt) : undefined;
      const guildIds = discordGuilds.map((guild) => guild.id);
      const guildCount = guildIds.length;

      // Find or create user — explicitly select oauthConnections so we can read
      // the connection array for the existing-user update path.
      let user = await UserModel.findOne({
        "oauthConnections.provider": "discord",
        "oauthConnections.providerId": discordUser.id,
      }).select("+oauthConnections");

      if (!user) {
        // Check if registration is enabled
        if (!settings.registrationEnabled) {
          context.set.status = 403;
          return { error: "Registration is currently disabled" };
        }

        // Create new user
        // Note: Discord removed discriminators in 2023, so just use username
        const username = discordUser.discriminator && discordUser.discriminator !== "0"
          ? `${discordUser.username}#${discordUser.discriminator}`
          : discordUser.username;

        user = await UserModel.create({
          username,
          email: discordUser.email,
          authMethods: [AuthMethod.DISCORD],
          oauthConnections: [
            {
              provider: "discord",
              providerId: discordUser.id,
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
              guildIds,
              guildCount,
              accountCreatedAt: accountCreatedAt ?? undefined,
              accountAgeDays,
              lastVerifiedAt: new Date(),
            },
          ],
          isActive: true,
        });

        await logInfo("New user registered via Discord", {
          userId: user._id.toString(),
          username: user.username,
        });
      } else {
        // Update OAuth tokens and lastLogin with a targeted atomic update.
        // Positional operator ($) updates the matched connection in-place.
        // Using updateOne avoids Mongoose save() issues with select:false Map fields.
        const connectionSetFields: Record<string, unknown> = {
          "oauthConnections.$.accessToken": tokenData.access_token,
          "oauthConnections.$.refreshToken": tokenData.refresh_token,
          "oauthConnections.$.expiresAt": new Date(Date.now() + tokenData.expires_in * 1000),
          "oauthConnections.$.guildIds": guildIds,
          "oauthConnections.$.guildCount": guildCount,
          "oauthConnections.$.accountAgeDays": accountAgeDays,
          "oauthConnections.$.lastVerifiedAt": new Date(),
          lastLogin: new Date(),
        };
        if (accountCreatedAt !== null) {
          connectionSetFields["oauthConnections.$.accountCreatedAt"] = accountCreatedAt;
        }
        await UserModel.updateOne(
          { _id: user._id, "oauthConnections.providerId": discordUser.id },
          { $set: connectionSetFields }
        );

        await logInfo("User logged in via Discord", {
          userId: user._id.toString(),
          username: user.username,
        });
      }

      // Check if user is active
      if (!user.isActive) {
        context.set.status = 403;
        return { error: "Account is disabled" };
      }

      // Generate JWT
      const token = generateToken({
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
      });

      // Create session
      await createSession(user._id.toString(), token, context);

      return {
        token,
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      console.error("Discord OAuth error:", error);
      if (error instanceof Error) {
        context.set.status = 500;
        return { error: "Failed to authenticate with Discord", message: error.message };
      }
      context.set.status = 500;
      return { error: "Failed to authenticate with Discord", message: "Unknown error" };
    }
  });

