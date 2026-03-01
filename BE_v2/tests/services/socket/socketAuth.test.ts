/**
 * socketAuth middleware — unit tests.
 *
 * Uses the createSocketAuthMiddleware factory with injected mocks so that
 * no real JWT signing or database calls are made.  Tests cover all auth
 * outcomes as pure function behaviour:
 *
 *   - missing token   → next(Error("Unauthorized: No token provided"))
 *   - invalid token   → next(Error("Unauthorized: Invalid token"))
 *   - revoked session → next(Error("Unauthorized: Session revoked or expired"))
 *   - valid auth      → socket.data populated, next() called with no error
 *
 * Token extraction tests cover both handshake.auth.token and Bearer header.
 */
import { describe, expect, it } from "bun:test";

import {
  createSocketAuthMiddleware,
  type SocketForAuth,
  type SocketNextFn,
  type SessionChecker,
  type TokenVerifier,
} from "../../../src/services/socket/socketAuth";
import type { JWTPayload } from "../../../src/utils/jwt";
import type { SocketData } from "../../../src/services/socket/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal SocketForAuth-compatible object. */
function makeSocket(opts: {
  authToken?: string;
  authorizationHeader?: string;
}): SocketForAuth {
  return {
    handshake: {
      auth: opts.authToken !== undefined ? { token: opts.authToken } : {},
      headers: {
        authorization: opts.authorizationHeader,
      },
    },
    data: {
      userId: "",
      username: "",
      email: "",
      role: "",
    } satisfies SocketData,
  };
}

/** Captures the error (if any) passed to next(). */
type NextCapture =
  | { called: false }
  | { called: true; error: (Error & { data?: unknown }) | undefined };

function makeNext(): { fn: SocketNextFn; result: () => NextCapture } {
  let capture: NextCapture = { called: false };
  const fn: SocketNextFn = (err) => {
    capture = { called: true, error: err };
  };
  return { fn, result: () => capture };
}

/** A valid JWT payload used throughout the tests. */
const validPayload: JWTPayload = {
  userId: "user-abc",
  username: "alice",
  email: "alice@test.com",
  role: "customer",
};

/** Verifier that always succeeds. */
const alwaysValidVerifier: TokenVerifier = () => validPayload;
/** Verifier that always rejects (returns null). */
const alwaysInvalidVerifier: TokenVerifier = () => null;
/** Session checker that always approves. */
const alwaysActiveSession: SessionChecker = async () => true;
/** Session checker that always rejects. */
const alwaysRevokedSession: SessionChecker = async () => false;
/** Session checker that throws (simulates DB error). */
const failingSession: SessionChecker = async () => {
  throw new Error("DB unavailable");
};

// ---------------------------------------------------------------------------
// Token extraction — handshake.auth.token
// ---------------------------------------------------------------------------
describe("socketAuthMiddleware — auth.token extraction", () => {
  it("accepts a token from handshake.auth.token", async () => {
    const middleware = createSocketAuthMiddleware(
      alwaysValidVerifier,
      alwaysActiveSession,
    );
    const socket = makeSocket({ authToken: "valid.jwt.token" });
    const { fn, result } = makeNext();

    await middleware(socket, fn);

    const capture = result();
    expect(capture.called).toBe(true);
    if (capture.called) {
      expect(capture.error).toBeUndefined();
    }
  });

  it("rejects when auth.token is an empty string", async () => {
    const middleware = createSocketAuthMiddleware(
      alwaysValidVerifier,
      alwaysActiveSession,
    );
    const socket = makeSocket({ authToken: "" });
    const { fn, result } = makeNext();

    await middleware(socket, fn);

    const capture = result();
    expect(capture.called).toBe(true);
    if (capture.called) {
      expect(capture.error).toBeInstanceOf(Error);
      expect(capture.error?.message).toContain("No token provided");
    }
  });
});

// ---------------------------------------------------------------------------
// Token extraction — Authorization Bearer header
// ---------------------------------------------------------------------------
describe("socketAuthMiddleware — Bearer header extraction", () => {
  it("accepts a token from Authorization: Bearer header", async () => {
    const middleware = createSocketAuthMiddleware(
      alwaysValidVerifier,
      alwaysActiveSession,
    );
    const socket = makeSocket({
      authorizationHeader: "Bearer valid.jwt.token",
    });
    const { fn, result } = makeNext();

    await middleware(socket, fn);

    const capture = result();
    expect(capture.called).toBe(true);
    if (capture.called) {
      expect(capture.error).toBeUndefined();
    }
  });

  it("rejects when Authorization header is present but not Bearer scheme", async () => {
    const middleware = createSocketAuthMiddleware(
      alwaysValidVerifier,
      alwaysActiveSession,
    );
    const socket = makeSocket({ authorizationHeader: "Basic dXNlcjpwYXNz" });
    const { fn, result } = makeNext();

    await middleware(socket, fn);

    const capture = result();
    expect(capture.called).toBe(true);
    if (capture.called) {
      expect(capture.error).toBeInstanceOf(Error);
      expect(capture.error?.message).toContain("No token provided");
    }
  });

  it("rejects when Authorization header is 'Bearer ' with no token", async () => {
    const middleware = createSocketAuthMiddleware(
      alwaysValidVerifier,
      alwaysActiveSession,
    );
    // "Bearer " is 7 chars — no payload after it (length === 7)
    const socket = makeSocket({ authorizationHeader: "Bearer " });
    const { fn, result } = makeNext();

    await middleware(socket, fn);

    const capture = result();
    expect(capture.called).toBe(true);
    if (capture.called) {
      expect(capture.error).toBeInstanceOf(Error);
      expect(capture.error?.message).toContain("No token provided");
    }
  });
});

// ---------------------------------------------------------------------------
// Missing token
// ---------------------------------------------------------------------------
describe("socketAuthMiddleware — missing token", () => {
  it("calls next with error when no token is provided at all", async () => {
    const middleware = createSocketAuthMiddleware(
      alwaysValidVerifier,
      alwaysActiveSession,
    );
    const socket = makeSocket({}); // neither auth.token nor header
    const { fn, result } = makeNext();

    await middleware(socket, fn);

    const capture = result();
    expect(capture.called).toBe(true);
    if (capture.called) {
      expect(capture.error).toBeInstanceOf(Error);
      expect(capture.error?.message).toContain("No token provided");
    }
  });
});

// ---------------------------------------------------------------------------
// Invalid / expired JWT
// ---------------------------------------------------------------------------
describe("socketAuthMiddleware — invalid token", () => {
  it("calls next with error when verifyToken returns null", async () => {
    const middleware = createSocketAuthMiddleware(
      alwaysInvalidVerifier,
      alwaysActiveSession,
    );
    const socket = makeSocket({ authToken: "bad.token" });
    const { fn, result } = makeNext();

    await middleware(socket, fn);

    const capture = result();
    expect(capture.called).toBe(true);
    if (capture.called) {
      expect(capture.error).toBeInstanceOf(Error);
      expect(capture.error?.message).toContain("Invalid token");
    }
  });
});

// ---------------------------------------------------------------------------
// Revoked / expired session
// ---------------------------------------------------------------------------
describe("socketAuthMiddleware — session check", () => {
  it("calls next with error when session checker returns false", async () => {
    const middleware = createSocketAuthMiddleware(
      alwaysValidVerifier,
      alwaysRevokedSession,
    );
    const socket = makeSocket({ authToken: "valid.jwt.token" });
    const { fn, result } = makeNext();

    await middleware(socket, fn);

    const capture = result();
    expect(capture.called).toBe(true);
    if (capture.called) {
      expect(capture.error).toBeInstanceOf(Error);
      expect(capture.error?.message).toContain("Session revoked or expired");
    }
  });

  it("calls next with error when session checker throws", async () => {
    const middleware = createSocketAuthMiddleware(
      alwaysValidVerifier,
      failingSession,
    );
    const socket = makeSocket({ authToken: "valid.jwt.token" });
    const { fn, result } = makeNext();

    await middleware(socket, fn);

    const capture = result();
    expect(capture.called).toBe(true);
    if (capture.called) {
      expect(capture.error).toBeInstanceOf(Error);
      expect(capture.error?.message).toContain("Session check failed");
    }
  });
});

// ---------------------------------------------------------------------------
// Successful authentication
// ---------------------------------------------------------------------------
describe("socketAuthMiddleware — successful auth", () => {
  it("calls next() with no error on valid token + active session", async () => {
    const middleware = createSocketAuthMiddleware(
      alwaysValidVerifier,
      alwaysActiveSession,
    );
    const socket = makeSocket({ authToken: "valid.jwt.token" });
    const { fn, result } = makeNext();

    await middleware(socket, fn);

    const capture = result();
    expect(capture.called).toBe(true);
    if (capture.called) {
      expect(capture.error).toBeUndefined();
    }
  });

  it("populates all four socket.data fields on successful auth", async () => {
    const middleware = createSocketAuthMiddleware(
      alwaysValidVerifier,
      alwaysActiveSession,
    );
    const socket = makeSocket({ authToken: "valid.jwt.token" });
    const { fn } = makeNext();

    await middleware(socket, fn);

    expect(socket.data.userId).toBe("user-abc");
    expect(socket.data.username).toBe("alice");
    expect(socket.data.email).toBe("alice@test.com");
    expect(socket.data.role).toBe("customer");
  });

  it("passes the correct token to the verifier and session checker", async () => {
    const capturedTokens: { verifier: string[]; session: string[] } = {
      verifier: [],
      session: [],
    };

    const verifier: TokenVerifier = (token) => {
      capturedTokens.verifier.push(token);
      return validPayload;
    };

    const sessionChecker: SessionChecker = async (token) => {
      capturedTokens.session.push(token);
      return true;
    };

    const middleware = createSocketAuthMiddleware(verifier, sessionChecker);
    const socket = makeSocket({ authToken: "my-specific-token" });
    const { fn } = makeNext();

    await middleware(socket, fn);

    expect(capturedTokens.verifier).toEqual(["my-specific-token"]);
    expect(capturedTokens.session).toEqual(["my-specific-token"]);
  });

  it("does not call session checker if token verification fails", async () => {
    let sessionCalled = false;
    const sessionChecker: SessionChecker = async () => {
      sessionCalled = true;
      return true;
    };

    const middleware = createSocketAuthMiddleware(
      alwaysInvalidVerifier,
      sessionChecker,
    );
    const socket = makeSocket({ authToken: "bad.token" });
    const { fn } = makeNext();

    await middleware(socket, fn);

    expect(sessionCalled).toBe(false);
  });

  it("does not call next() more than once on success", async () => {
    let callCount = 0;
    const countingNext: SocketNextFn = () => {
      callCount++;
    };

    const middleware = createSocketAuthMiddleware(
      alwaysValidVerifier,
      alwaysActiveSession,
    );
    const socket = makeSocket({ authToken: "valid.jwt.token" });

    await middleware(socket, countingNext);

    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Precedence: auth.token takes priority over Bearer header
// ---------------------------------------------------------------------------
describe("socketAuthMiddleware — token source precedence", () => {
  it("uses auth.token over Authorization header when both are present", async () => {
    const capturedTokens: string[] = [];
    const verifier: TokenVerifier = (token) => {
      capturedTokens.push(token);
      return validPayload;
    };

    const middleware = createSocketAuthMiddleware(verifier, alwaysActiveSession);
    const socket = makeSocket({
      authToken: "token-from-auth",
      authorizationHeader: "Bearer token-from-header",
    });
    const { fn } = makeNext();

    await middleware(socket, fn);

    // Should use the auth.token, not the header token
    expect(capturedTokens).toEqual(["token-from-auth"]);
  });
});
