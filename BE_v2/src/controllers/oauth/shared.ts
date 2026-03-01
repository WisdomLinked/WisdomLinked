/**
 * Shared utilities for OAuth controllers
 */
import { Context } from "elysia";
import { SessionModel, parseUserAgent } from "../../models/Session";

export function getClientInfo(context: Context) {
  const request = context.request as Request;
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  return { ipAddress, userAgent };
}

export async function createSession(userId: string, token: string, context: Context) {
  const { ipAddress, userAgent } = getClientInfo(context);
  const deviceInfo = parseUserAgent(userAgent);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await SessionModel.create({
    userId,
    token,
    ipAddress,
    userAgent,
    deviceInfo,
    isActive: true,
    lastActivity: new Date(),
    expiresAt,
  });
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  email: string;
  avatar: string;
}

export interface DiscordTokenData {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface DiscordGuild {
  id: string;
  name: string;
  owner?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseDiscordTokenData(value: unknown): DiscordTokenData | null {
  if (!isRecord(value)) return null;
  if (typeof value.access_token !== "string") return null;
  if (typeof value.expires_in !== "number") return null;

  const refreshToken = typeof value.refresh_token === "string" ? value.refresh_token : undefined;
  return {
    access_token: value.access_token,
    refresh_token: refreshToken,
    expires_in: value.expires_in,
  };
}

export function parseDiscordUser(value: unknown): DiscordUser | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.username !== "string") return null;

  return {
    id: value.id,
    username: value.username,
    discriminator: typeof value.discriminator === "string" ? value.discriminator : "0",
    email: typeof value.email === "string" ? value.email : "",
    avatar: typeof value.avatar === "string" ? value.avatar : "",
  };
}

export function parseDiscordGuilds(value: unknown): DiscordGuild[] | null {
  if (!Array.isArray(value)) return null;

  const guilds: DiscordGuild[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    if (typeof item.id !== "string") return null;
    if (typeof item.name !== "string") return null;
    guilds.push({
      id: item.id,
      name: item.name,
      owner: typeof item.owner === "boolean" ? item.owner : undefined,
    });
  }

  return guilds;
}

export function getDiscordAccountCreatedAt(discordUserId: string): Date | null {
  try {
    const discordEpochMs = 1420070400000n;
    const snowflake = BigInt(discordUserId);
    const timestampMs = (snowflake >> 22n) + discordEpochMs;
    return new Date(Number(timestampMs));
  } catch {
    return null;
  }
}

export function getAccountAgeDays(createdAt: Date): number {
  const msInDay = 24 * 60 * 60 * 1000;
  const diffMs = Date.now() - createdAt.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / msInDay);
}

