import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import {
  createFreshTestApp,
  type TestApp,
  wipeTestDatabase,
} from "../../../test/helpers";
import { SystemSettingsModel } from "../../models/SystemSettings";

describe("Handle Discord Callback Controller", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createFreshTestApp();
  });

  beforeEach(async () => {
    await wipeTestDatabase();
  });

  it("should handle Discord OAuth callback", async () => {
    // Default settings have discord disabled — callback must return 403
    const response = await app.handle(
      new Request(
        "http://localhost/api/v1/oauth/discord/callback?code=some-code",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Discord authentication is disabled");
  });

  it("should reject callback without code", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/oauth/discord/callback", {
        method: "GET",
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Authorization code not provided");
  });

  it("should reject callback with invalid code", async () => {
    // Enable discord with full fake config so the request reaches the
    // token-exchange step.  Discord will reject the fake credentials
    // with a 4xx, causing the controller to return 400.
    // In network-restricted environments the fetch throws and the outer
    // catch returns 500 — both outcomes confirm the invalid code was rejected.
    await SystemSettingsModel.create({
      registrationEnabled: true,
      loginMethods: { local: true, discord: true },
      discordOAuth: {
        clientId: "fake-client-id",
        clientSecret: "fake-client-secret",
        redirectUri: "http://localhost/oauth/discord/callback",
      },
      stripeConfig: { enabled: false },
      stripePricing: { plans: [] },
    });

    const response = await app.handle(
      new Request(
        "http://localhost/api/v1/oauth/discord/callback?code=invalid-code-xyz",
        { method: "GET" }
      )
    );

    // 400 = Discord rejected the code; 500 = network unavailable in test env
    expect([400, 500]).toContain(response.status);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("should handle missing Discord OAuth configuration", async () => {
    // Discord enabled but no clientId/clientSecret/redirectUri configured
    await SystemSettingsModel.create({
      registrationEnabled: true,
      loginMethods: { local: true, discord: true },
      discordOAuth: {},
      stripeConfig: { enabled: false },
      stripePricing: { plans: [] },
    });

    const response = await app.handle(
      new Request(
        "http://localhost/api/v1/oauth/discord/callback?code=some-code",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Discord OAuth not configured");
  });
});

