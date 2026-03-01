/**
 * generateDemoTokenController — public endpoint for demo video calls.
 *
 * POST /api/v1/demo/video-token
 * Body: { roomName: string, participantName: string }
 *
 * Returns a LiveKit JWT that allows the participant to join the named room.
 * No authentication required — this is a public demo endpoint.
 */

import { Elysia, t } from "elysia";
import { AccessToken } from "livekit-server-sdk";

import { getBackendEnvironmentConfig } from "../../config/env";

export const generateDemoTokenController = new Elysia().post(
  "/video-token",
  async (context) => {
    const env = getBackendEnvironmentConfig();

    if (!env.livekitEnabled || env.livekitApiKey === undefined || env.livekitApiSecret === undefined) {
      context.set.status = 503;
      return { error: "Video service is not configured" };
    }

    const { roomName, participantName } = context.body;
    const apiKey = env.livekitApiKey;
    const apiSecret = env.livekitApiSecret;

    try {
      const at = new AccessToken(apiKey, apiSecret, {
        identity: participantName,
        ttl: "1h",
      });
      at.addGrant({ roomJoin: true, room: roomName });
      const token = await at.toJwt();
      return { token };
    } catch (error) {
      context.set.status = 500;
      return {
        error: "Failed to generate video token",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    body: t.Object({
      roomName: t.String({ minLength: 1, maxLength: 64 }),
      participantName: t.String({ minLength: 1, maxLength: 64 }),
    }),
  },
);
