/**
 * Shared utilities for auth controllers
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
  
  // Calculate expiration (7 days from now, matching JWT)
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

