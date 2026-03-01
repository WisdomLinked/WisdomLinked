import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
} from "../../../test/helpers";
import { SystemSettingsModel } from "../../models/SystemSettings";

describe("Get Discord Auth URL Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should return Discord OAuth URL", async () => {
    // Enable discord and provide full OAuth configuration
    await SystemSettingsModel.create({
      registrationEnabled: true,
      loginMethods: { local: true, discord: true },
      discordOAuth: {
        clientId: "fake-discord-client-id",
        redirectUri: "http://localhost/oauth/discord/callback",
      },
      stripeConfig: { enabled: false },
      stripePricing: { plans: [] },
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/oauth/discord", {
        method: "GET",
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.authUrl).toBeDefined();
    expect(data.authUrl).toContain("discord.com");
    expect(data.authUrl).toContain("fake-discord-client-id");
  });

  it("should handle missing Discord OAuth configuration", async () => {
    // Enable discord but do not provide clientId or redirectUri
    await SystemSettingsModel.create({
      registrationEnabled: true,
      loginMethods: { local: true, discord: true },
      discordOAuth: {},
      stripeConfig: { enabled: false },
      stripePricing: { plans: [] },
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/oauth/discord", {
        method: "GET",
      })
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Discord OAuth not configured");
  });
});

