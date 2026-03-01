import { Context } from "elysia";
import { MetricsModel } from "../models/Metrics";
import type { AuthUser } from "./auth";

export async function metricsMiddleware(context: Context & { user?: AuthUser; request: Request }) {
  const startTime = Date.now();

  // Extract request details
  const path = new URL(context.request.url).pathname;
  const method = context.request.method;
  const ip = context.request.headers.get("x-forwarded-for") || 
             context.request.headers.get("x-real-ip") || 
             "unknown";

  // Record metrics after response
  try {
    const responseTime = Date.now() - startTime;
    
    await MetricsModel.create({
      path,
      method,
      ip,
      username: context.user?.username,
      userId: context.user?.userId,
      isAuthenticated: !!context.user,
      timestamp: new Date(),
      responseTime,
      statusCode: context.set.status || 200,
    });
  } catch (error) {
    console.error("Failed to record metrics:", error);
  }
}

