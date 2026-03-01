/**
 * ConnectionRegistry — pure unit tests.
 *
 * These tests exercise only in-memory state (no I/O, no DB).
 * They verify the invariants declared in connectionRegistry.ts:
 *
 *   I1. addConnection: idempotent per socket, accumulates for multi-tab.
 *   I2. removeConnection: returns true iff user is fully offline.
 *   I3. isOnline ↔ getSocketIds !== undefined.
 *   I4. getOnlineUserIds: reflects current connected set.
 *
 * Each test uses a fresh ConnectionRegistry instance to guarantee isolation.
 */
import { describe, expect, it } from "bun:test";
import { ConnectionRegistry } from "../../../src/services/socket/connectionRegistry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRegistry(): ConnectionRegistry {
  return new ConnectionRegistry();
}

// ---------------------------------------------------------------------------
// addConnection
// ---------------------------------------------------------------------------
describe("ConnectionRegistry.addConnection", () => {
  it("registers a user as online after first connection", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    expect(reg.isOnline("user-1")).toBe(true);
  });

  it("tracks the correct socket ID", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    const ids = reg.getSocketIds("user-1");
    expect(ids).toBeDefined();
    expect(ids?.has("socket-a")).toBe(true);
  });

  it("accumulates multiple socket IDs for multi-tab sessions", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.addConnection("user-1", "socket-b");
    reg.addConnection("user-1", "socket-c");

    const ids = reg.getSocketIds("user-1");
    expect(ids?.size).toBe(3);
    expect(ids?.has("socket-a")).toBe(true);
    expect(ids?.has("socket-b")).toBe(true);
    expect(ids?.has("socket-c")).toBe(true);
  });

  it("is idempotent when the same socket is added twice", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.addConnection("user-1", "socket-a"); // duplicate

    const ids = reg.getSocketIds("user-1");
    expect(ids?.size).toBe(1);
  });

  it("handles multiple distinct users independently", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.addConnection("user-2", "socket-b");

    expect(reg.isOnline("user-1")).toBe(true);
    expect(reg.isOnline("user-2")).toBe(true);

    const ids1 = reg.getSocketIds("user-1");
    const ids2 = reg.getSocketIds("user-2");
    expect(ids1?.has("socket-a")).toBe(true);
    expect(ids2?.has("socket-b")).toBe(true);
    // Cross-contamination check
    expect(ids1?.has("socket-b")).toBe(false);
    expect(ids2?.has("socket-a")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// removeConnection
// ---------------------------------------------------------------------------
describe("ConnectionRegistry.removeConnection", () => {
  it("returns true when user has no remaining connections (single tab)", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");

    const isOffline = reg.removeConnection("user-1", "socket-a");
    expect(isOffline).toBe(true);
  });

  it("marks user as offline after last socket removed", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.removeConnection("user-1", "socket-a");

    expect(reg.isOnline("user-1")).toBe(false);
    expect(reg.getSocketIds("user-1")).toBeUndefined();
  });

  it("returns false when user still has other active connections (multi-tab)", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.addConnection("user-1", "socket-b");

    const isOffline = reg.removeConnection("user-1", "socket-a");
    expect(isOffline).toBe(false);
  });

  it("user stays online after partial disconnect (multi-tab)", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.addConnection("user-1", "socket-b");
    reg.removeConnection("user-1", "socket-a");

    expect(reg.isOnline("user-1")).toBe(true);
    const ids = reg.getSocketIds("user-1");
    expect(ids?.has("socket-a")).toBe(false);
    expect(ids?.has("socket-b")).toBe(true);
  });

  it("correctly detects fully-offline after removing all sockets (multi-tab)", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.addConnection("user-1", "socket-b");
    reg.addConnection("user-1", "socket-c");

    reg.removeConnection("user-1", "socket-a");
    reg.removeConnection("user-1", "socket-b");

    // Still online — one socket left
    expect(reg.isOnline("user-1")).toBe(true);

    const isOffline = reg.removeConnection("user-1", "socket-c");
    expect(isOffline).toBe(true);
    expect(reg.isOnline("user-1")).toBe(false);
  });

  it("returns true (treats as offline) when removing an unknown socketId", () => {
    const reg = makeRegistry();
    // No addConnection called — user is unknown
    const result = reg.removeConnection("unknown-user", "ghost-socket");
    expect(result).toBe(true);
  });

  it("removing one user's socket does not affect another user", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.addConnection("user-2", "socket-b");

    reg.removeConnection("user-1", "socket-a");

    expect(reg.isOnline("user-1")).toBe(false);
    expect(reg.isOnline("user-2")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isOnline
// ---------------------------------------------------------------------------
describe("ConnectionRegistry.isOnline", () => {
  it("returns false for a user who has never connected", () => {
    const reg = makeRegistry();
    expect(reg.isOnline("never-connected")).toBe(false);
  });

  it("returns true after addConnection", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    expect(reg.isOnline("user-1")).toBe(true);
  });

  it("returns false after full disconnect", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.removeConnection("user-1", "socket-a");
    expect(reg.isOnline("user-1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getOnlineUserIds
// ---------------------------------------------------------------------------
describe("ConnectionRegistry.getOnlineUserIds", () => {
  it("returns empty array when no one is connected", () => {
    const reg = makeRegistry();
    expect(reg.getOnlineUserIds()).toEqual([]);
  });

  it("returns the connected user IDs", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.addConnection("user-2", "socket-b");

    const online = reg.getOnlineUserIds();
    expect(online).toHaveLength(2);
    expect(online).toContain("user-1");
    expect(online).toContain("user-2");
  });

  it("does not include users who have fully disconnected", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.addConnection("user-2", "socket-b");
    reg.removeConnection("user-1", "socket-a");

    const online = reg.getOnlineUserIds();
    expect(online).toHaveLength(1);
    expect(online).toContain("user-2");
    expect(online).not.toContain("user-1");
  });

  it("multi-tab user appears once in the list", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.addConnection("user-1", "socket-b");
    reg.addConnection("user-1", "socket-c");

    const online = reg.getOnlineUserIds();
    expect(online).toHaveLength(1);
    expect(online).toContain("user-1");
  });
});

// ---------------------------------------------------------------------------
// getSocketIds
// ---------------------------------------------------------------------------
describe("ConnectionRegistry.getSocketIds", () => {
  it("returns undefined for offline user", () => {
    const reg = makeRegistry();
    expect(reg.getSocketIds("offline-user")).toBeUndefined();
  });

  it("returns the set of socket IDs for a connected user", () => {
    const reg = makeRegistry();
    reg.addConnection("user-1", "socket-a");
    reg.addConnection("user-1", "socket-b");

    const ids = reg.getSocketIds("user-1");
    expect(ids).toBeDefined();
    expect(ids?.size).toBe(2);
    expect(ids?.has("socket-a")).toBe(true);
    expect(ids?.has("socket-b")).toBe(true);
  });
});
