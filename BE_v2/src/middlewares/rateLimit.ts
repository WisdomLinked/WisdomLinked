import { Context } from "elysia";
import type { AuthUser } from "./auth";

// In-memory rate limit storage
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS_IP = 1000; // Very generous for anonymous users
const RATE_LIMIT_MAX_REQUESTS_USER = 2000; // Even more generous for authenticated users

function getRateLimitKey(identifier: string, type: "ip" | "user"): string {
  return `${type}:${identifier}`;
}

function checkRateLimit(key: string, maxRequests: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

export function rateLimitMiddleware(context: Context & { user?: AuthUser; request: Request }) {
  const ip = context.request.headers.get("x-forwarded-for") || 
             context.request.headers.get("x-real-ip") || 
             "unknown";

  // Check if user is authenticated
  if (context.user) {
    const userKey = getRateLimitKey(context.user.userId, "user");
    if (!checkRateLimit(userKey, RATE_LIMIT_MAX_REQUESTS_USER)) {
      context.set.status = 429;
      throw new Error("Rate limit exceeded. Please try again later.");
    }
  } else {
    const ipKey = getRateLimitKey(ip, "ip");
    if (!checkRateLimit(ipKey, RATE_LIMIT_MAX_REQUESTS_IP)) {
      context.set.status = 429;
      throw new Error("Rate limit exceeded. Please try again later.");
    }
  }
}

