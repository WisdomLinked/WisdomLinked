/**
 * Socket.IO authentication middleware.
 *
 * Validates JWT tokens and active sessions for every incoming connection.
 * Follows the same pattern as middlewares/auth.ts (the HTTP auth boundary):
 *   1. Extract token from handshake.
 *   2. Verify JWT signature.
 *   3. Confirm the session is still active in the database.
 *   4. Populate socket.data with the authenticated user.
 *
 * The factory function (createSocketAuthMiddleware) accepts injectable
 * verifier/checker functions so the logic can be tested without I/O.
 *
 * Invariants:
 *   - A socket is only allowed to connect if ALL three checks pass.
 *   - socket.data is fully populated (all four fields) before next() is called.
 *   - Every error path calls next(error) and returns immediately.
 */
import type { IncomingHttpHeaders } from "node:http";

import { SessionModel } from "../../models/Session";
import { verifyToken } from "../../utils/jwt";
import type { JWTPayload } from "../../utils/jwt";
import type { SocketData } from "./types";

// ---------------------------------------------------------------------------
// Structural interface used for the socket parameter.
//
// TypedSocket (the full socket.io Socket class) is structurally assignable to
// SocketForAuth, so the middleware can be registered with io.use() without
// casts, while remaining testable with plain objects.
// ---------------------------------------------------------------------------
export interface SocketForAuth {
  readonly handshake: {
    readonly auth: Record<string, unknown>;
    readonly headers: IncomingHttpHeaders;
  };
  data: SocketData;
}

// ---------------------------------------------------------------------------
// next() type aligned with socket.io's internal ExtendedError shape.
// data is optional, so plain Error satisfies this type at call sites.
// ---------------------------------------------------------------------------
export type SocketNextFn = (err?: Error & { data?: unknown }) => void;

// ---------------------------------------------------------------------------
// Injectable dependency types — enables pure-function testing.
// ---------------------------------------------------------------------------
export type TokenVerifier = (token: string) => JWTPayload | null;
export type SessionChecker = (token: string) => Promise<boolean>;

// ---------------------------------------------------------------------------
// Pure helper: extract the bearer token from handshake fields.
// Returns null when no valid token is present.
// ---------------------------------------------------------------------------
function extractToken(socket: SocketForAuth): string | null {
  // Prefer auth.token (set explicitly by the client SDK)
  const rawAuthToken = socket.handshake.auth["token"];
  if (typeof rawAuthToken === "string" && rawAuthToken.length > 0) {
    return rawAuthToken;
  }

  // Fall back to Authorization header (Bearer scheme)
  const authHeader = socket.handshake.headers.authorization;
  if (
    typeof authHeader === "string" &&
    authHeader.startsWith("Bearer ") &&
    authHeader.length > 7
  ) {
    return authHeader.substring(7);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Factory: creates a middleware with injected verifier and session checker.
// The returned function is the unit under test.
// ---------------------------------------------------------------------------
export function createSocketAuthMiddleware(
  verifyTokenFn: TokenVerifier,
  checkSessionFn: SessionChecker,
): (socket: SocketForAuth, next: SocketNextFn) => Promise<void> {
  return async (socket: SocketForAuth, next: SocketNextFn): Promise<void> => {
    const token = extractToken(socket);
    if (token === null) {
      next(new Error("Unauthorized: No token provided"));
      return;
    }

    const payload = verifyTokenFn(token);
    if (payload === null) {
      next(new Error("Unauthorized: Invalid token"));
      return;
    }

    let sessionValid: boolean;
    try {
      sessionValid = await checkSessionFn(token);
    } catch {
      next(new Error("Unauthorized: Session check failed"));
      return;
    }

    if (!sessionValid) {
      next(new Error("Unauthorized: Session revoked or expired"));
      return;
    }

    // Populate socket metadata — fully typed, no partial assignment.
    socket.data.userId = payload.userId;
    socket.data.username = payload.username;
    socket.data.email = payload.email;
    socket.data.role = payload.role;

    next();
  };
}

// ---------------------------------------------------------------------------
// Default session checker: mirrors the auth.ts pattern exactly.
// Updates lastActivity on successful validation.
// ---------------------------------------------------------------------------
async function defaultSessionChecker(token: string): Promise<boolean> {
  const session = await SessionModel.findOneAndUpdate(
    {
      token,
      isActive: true,
      expiresAt: { $gt: new Date() },
    },
    { lastActivity: new Date() },
    { new: true },
  )
    .lean()
    .exec();

  return session !== null;
}

// ---------------------------------------------------------------------------
// Ready-to-use middleware instance (uses real JWT + DB implementations).
// ---------------------------------------------------------------------------
export const socketAuthMiddleware = createSocketAuthMiddleware(
  verifyToken,
  defaultSessionChecker,
);
