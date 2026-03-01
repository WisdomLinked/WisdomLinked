import { Context, Elysia } from "elysia";
import { UserRole } from "../config/roles";
import { verifyToken } from "../utils/jwt";
import { SessionModel } from "../models/Session";

export interface AuthUser {
  userId: string;
  username: string;
  email: string;
  role: string;
}

export type AuthContext = Context & {
  user: AuthUser;
};

type RequestHeaders = Record<string, string | undefined>;
type StatusSetter = { status?: number | string };

function getBearerToken(headers: RequestHeaders): string {
  const authHeader = headers.authorization ?? headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Authentication required");
  }
  return authHeader.substring(7);
}

async function authenticateToken(
  headers: RequestHeaders,
  set: StatusSetter,
  requireAdminRole: boolean
): Promise<{ user: AuthUser }> {
  let token: string;
  try {
    token = getBearerToken(headers);
  } catch {
    set.status = 401;
    throw new Error("Unauthorized: Authentication required");
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    set.status = 401;
    throw new Error("Unauthorized: Invalid token");
  }

  if (requireAdminRole && decoded.role !== UserRole.ADMIN) {
    set.status = 403;
    throw new Error("Forbidden: Admin access required");
  }

  // Enforce active session as an authoritative auth boundary.
  const session = await SessionModel.findOneAndUpdate(
    {
      token,
      isActive: true,
      expiresAt: { $gt: new Date() },
    },
    { lastActivity: new Date() },
    { new: true }
  )
    .lean()
    .exec();

  if (!session) {
    set.status = 401;
    throw new Error("Unauthorized: Session revoked or expired");
  }

  const user: AuthUser = {
    userId: decoded.userId,
    username: decoded.username,
    email: decoded.email,
    role: decoded.role,
  };

  return {
    user,
  };
}

// Authentication middleware - requires valid auth token and active session
export const requireAuth = new Elysia().derive({ as: "scoped" }, async ({ headers, set }) =>
  authenticateToken(headers as RequestHeaders, set, false)
);

// Admin authentication middleware - requires valid auth token, active session, and admin role
export const requireAdmin = new Elysia().derive({ as: "scoped" }, async ({ headers, set }) =>
  authenticateToken(headers as RequestHeaders, set, true)
);
