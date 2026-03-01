/**
 * Tests for the generateDemoToken controller.
 *
 * Uses mock.module for both env config and livekit-server-sdk because:
 *  - env: we need per-test control over livekitEnabled without mutating process.env
 *  - livekit-server-sdk: we mock the AccessToken to return a predictable JWT
 *    without needing real credentials or network access.
 *
 * The controller is loaded via dynamic import AFTER mocks are registered, which
 * is required because mock.module in Bun is not automatically hoisted.
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";

import type { BackendEnvironmentConfig } from "../../config/env";

// ── Per-test mutable state ────────────────────────────────────────────────────

const mockLivekitState: {
  livekitEnabled: boolean;
  livekitApiKey: string | undefined;
  livekitApiSecret: string | undefined;
} = { livekitEnabled: false, livekitApiKey: undefined, livekitApiSecret: undefined };

// ── Mock env module — must be registered before the controller is imported ────

mock.module("../../config/env", () => ({
  getBackendEnvironmentConfig: (): BackendEnvironmentConfig => ({
    mode: "test",
    mongoUri: "mongodb://localhost:27017",
    devDbName: "wisdomlinked_dev",
    prodDbName: "wisdomlinked_prod",
    ephemeralTestDbName: "wisdomlinked_test",
    jwtSecret: "test-jwt-secret",
    jwtExpiresIn: "1h",
    port: 5000,
    frontendUrl: "http://localhost:5173",
    sendgridEnabled: false,
    s3Enabled: false,
    stripeEnabled: false,
    livekitEnabled: mockLivekitState.livekitEnabled,
    livekitApiKey: mockLivekitState.livekitApiKey,
    livekitApiSecret: mockLivekitState.livekitApiSecret,
  }),
}));

// ── Mock livekit-server-sdk — returns a predictable token without real signing ─

mock.module("livekit-server-sdk", () => {
  class MockAccessToken {
    constructor(
      _apiKey: string,
      _apiSecret: string,
      _opts?: { identity?: string; ttl?: string | number },
    ) {}
    addGrant(_grant: { roomJoin?: boolean; room?: string }): void {}
    async toJwt(): Promise<string> {
      return "mock-livekit-jwt-token";
    }
  }
  return { AccessToken: MockAccessToken };
});

// ── Import controller AFTER mocks are in place ────────────────────────────────

const { generateDemoTokenController } = await import("./generateDemoToken.controller");

// ── Test app factory ──────────────────────────────────────────────────────────

function buildDemoApp() {
  return new Elysia({ prefix: "/api/v1/demo" }).use(generateDemoTokenController);
}

// ── Reset LiveKit mock state before each test ─────────────────────────────────

beforeEach(() => {
  mockLivekitState.livekitEnabled = false;
  mockLivekitState.livekitApiKey = undefined;
  mockLivekitState.livekitApiSecret = undefined;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateDemoToken controller", () => {
  describe("POST /api/v1/demo/video-token", () => {
    it("returns 503 when LiveKit is not configured", async () => {
      // Default mock state: livekitEnabled = false
      const app = buildDemoApp();

      const response = await app.handle(
        new Request("http://localhost/api/v1/demo/video-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: "test-room", participantName: "alice" }),
        }),
      );

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe("Video service is not configured");
    });

    it("returns 422 for empty roomName (minLength: 1 violated)", async () => {
      const app = buildDemoApp();

      const response = await app.handle(
        new Request("http://localhost/api/v1/demo/video-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: "", participantName: "alice" }),
        }),
      );

      expect(response.status).toBe(422);
    });

    it("returns 422 for empty participantName (minLength: 1 violated)", async () => {
      const app = buildDemoApp();

      const response = await app.handle(
        new Request("http://localhost/api/v1/demo/video-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: "test-room", participantName: "" }),
        }),
      );

      expect(response.status).toBe(422);
    });

    it("returns 422 when required body fields are missing", async () => {
      const app = buildDemoApp();

      const response = await app.handle(
        new Request("http://localhost/api/v1/demo/video-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(422);
    });

    it("returns 200 with token string when LiveKit is configured", async () => {
      mockLivekitState.livekitEnabled = true;
      mockLivekitState.livekitApiKey = "test-livekit-api-key";
      mockLivekitState.livekitApiSecret = "test-livekit-api-secret";

      const app = buildDemoApp();

      const response = await app.handle(
        new Request("http://localhost/api/v1/demo/video-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: "my-demo-room", participantName: "bob" }),
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(typeof data.token).toBe("string");
      expect(data.token.length).toBeGreaterThan(0);
    });
  });
});
