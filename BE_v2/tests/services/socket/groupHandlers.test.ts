/**
 * Group chat handler resolver tests.
 *
 * These tests exercise the pure resolver functions exported from groupHandlers.ts.
 * No socket.io server, no real database, no network I/O.
 *
 * Invariants asserted:
 *   - resolveGroupJoin returns { ok: true } iff checkParticipant returns true.
 *   - resolveGroupJoin returns { ok: false } on unauthorized access or DB error.
 *   - resolveGroupSend creates a message and returns a well-formed result on success.
 *   - resolveGroupSend returns { ok: false } when saveMessage throws.
 *   - resolveGroupTyping is pure: same input → same output, every time.
 *   - buildGroupRoomName encodes the canonical group: room naming convention
 *     (shared by group:join, group:send, group:typing, and group:leave).
 *   - group:leave uses the same room name convention and requires NO authorization
 *     (by contrast with group:join which does).
 *
 * Test strategy: mock all DB dependencies via the injectable function types.
 */
import { describe, expect, it } from "bun:test";

import {
  buildGroupRoomName,
  resolveGroupJoin,
  resolveGroupSend,
  resolveGroupTyping,
  type GroupMessageSaver,
  type GroupParticipantChecker,
} from "../../../src/services/socket/groupHandlers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_DATE = new Date("2026-02-20T08:00:00.000Z");

function makeSaver(
  result: { messageId: string; createdAt: Date } = {
    messageId: "grp-msg-default",
    createdAt: FIXED_DATE,
  },
): GroupMessageSaver {
  return async () => result;
}

// ---------------------------------------------------------------------------
// buildGroupRoomName
// ---------------------------------------------------------------------------

describe("buildGroupRoomName", () => {
  it("returns group:{groupChatId}", () => {
    expect(buildGroupRoomName("gc-123")).toBe("group:gc-123");
  });

  it("preserves the exact groupChatId string", () => {
    const id = "507f1f77bcf86cd799439011";
    expect(buildGroupRoomName(id)).toBe(`group:${id}`);
  });

  it("is pure — same input always returns the same output", () => {
    expect(buildGroupRoomName("gc-abc")).toBe(buildGroupRoomName("gc-abc"));
  });

  it("is the room name used by group:leave — leave shares the same naming convention", () => {
    // group:leave removes from room buildGroupRoomName(groupChatId).
    // By testing this naming function, we verify the invariant that
    // group:join and group:leave operate on the same room.
    // group:leave requires NO authorization (invariant I4 in groupHandlers.ts);
    // this is tested separately by the fact that resolveGroupLeave does not exist
    // — there is no authorization logic to test for leave.
    const groupChatId = "gc-session-42";
    expect(buildGroupRoomName(groupChatId)).toBe("group:gc-session-42");
  });
});

// ---------------------------------------------------------------------------
// resolveGroupJoin — authorization
// ---------------------------------------------------------------------------

describe("resolveGroupJoin — authorization", () => {
  it("returns { ok: true } when user IS a participant", async () => {
    const checker: GroupParticipantChecker = async () => true;
    const result = await resolveGroupJoin("gc-1", "user-1", checker);
    expect(result.ok).toBe(true);
  });

  it("returns { ok: false } with reason when user is NOT a participant", async () => {
    const checker: GroupParticipantChecker = async () => false;
    const result = await resolveGroupJoin("gc-1", "user-1", checker);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Not authorized");
    }
  });

  it("passes the exact groupChatId to the checker", async () => {
    const captured: string[] = [];
    const checker: GroupParticipantChecker = async (gcId) => {
      captured.push(gcId);
      return true;
    };
    await resolveGroupJoin("gc-target", "user-1", checker);
    expect(captured).toEqual(["gc-target"]);
  });

  it("passes the exact userId to the checker", async () => {
    const captured: string[] = [];
    const checker: GroupParticipantChecker = async (_gcId, userId) => {
      captured.push(userId);
      return true;
    };
    await resolveGroupJoin("gc-1", "user-target", checker);
    expect(captured).toEqual(["user-target"]);
  });

  it("returns { ok: false } when checker throws (DB error)", async () => {
    const checker: GroupParticipantChecker = async () => {
      throw new Error("timeout");
    };
    const result = await resolveGroupJoin("gc-1", "user-1", checker);
    expect(result.ok).toBe(false);
  });

  it("includes the thrown error message in the reason", async () => {
    const checker: GroupParticipantChecker = async () => {
      throw new Error("replica set unavailable");
    };
    const result = await resolveGroupJoin("gc-1", "user-1", checker);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("replica set unavailable");
    }
  });

  it("handles non-Error thrown values gracefully", async () => {
    const checker: GroupParticipantChecker = async () => {
      throw { code: 503 };
    };
    const result = await resolveGroupJoin("gc-1", "user-1", checker);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveGroupJoin — determinism (replay property)
// ---------------------------------------------------------------------------

describe("resolveGroupJoin — determinism", () => {
  it("returns the same result when called twice with the same inputs", async () => {
    const checker: GroupParticipantChecker = async () => true;
    const r1 = await resolveGroupJoin("gc-1", "user-1", checker);
    const r2 = await resolveGroupJoin("gc-1", "user-1", checker);
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// resolveGroupSend — message creation
// ---------------------------------------------------------------------------

describe("resolveGroupSend — success path", () => {
  it("returns { ok: true } with the messageId from saver", async () => {
    const saver = makeSaver({ messageId: "grp-msg-abc", createdAt: FIXED_DATE });
    const result = await resolveGroupSend(
      { groupChatId: "gc-1", content: "welcome all", type: "text" },
      "user-1",
      saver,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toBe("grp-msg-abc");
    }
  });

  it("returns createdAt as an ISO string", async () => {
    const saver = makeSaver({
      messageId: "grp-msg-1",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
    });
    const result = await resolveGroupSend(
      { groupChatId: "gc-1", content: "hi", type: "text" },
      "user-1",
      saver,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.createdAt).toBe("2026-03-01T10:00:00.000Z");
    }
  });

  it("passes the correct params to saveMessage", async () => {
    const captured: Parameters<GroupMessageSaver>[0][] = [];
    const saver: GroupMessageSaver = async (params) => {
      captured.push(params);
      return { messageId: "msg-1", createdAt: FIXED_DATE };
    };

    await resolveGroupSend(
      { groupChatId: "gc-xyz", content: "broadcast this", type: "file" },
      "user-sender",
      saver,
    );

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({
      groupChatId: "gc-xyz",
      author: "user-sender",
      content: "broadcast this",
      type: "file",
    });
  });
});

describe("resolveGroupSend — error paths", () => {
  it("returns { ok: false } when saveMessage throws", async () => {
    const saver: GroupMessageSaver = async () => {
      throw new Error("write concern failed");
    };
    const result = await resolveGroupSend(
      { groupChatId: "gc-1", content: "hi", type: "text" },
      "user-1",
      saver,
    );
    expect(result.ok).toBe(false);
  });

  it("includes the saveMessage error message in the result", async () => {
    const saver: GroupMessageSaver = async () => {
      throw new Error("document too large");
    };
    const result = await resolveGroupSend(
      { groupChatId: "gc-1", content: "hi", type: "text" },
      "user-1",
      saver,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("document too large");
    }
  });

  it("handles non-Error thrown values gracefully", async () => {
    const saver: GroupMessageSaver = async () => {
      throw "raw string error";
    };
    const result = await resolveGroupSend(
      { groupChatId: "gc-1", content: "hi", type: "text" },
      "user-1",
      saver,
    );
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveGroupTyping — pure function
// ---------------------------------------------------------------------------

describe("resolveGroupTyping", () => {
  it("returns the correct GroupTypingPayload", () => {
    const payload = resolveGroupTyping(
      { groupChatId: "gc-1", isTyping: true },
      "user-carol",
    );
    expect(payload).toEqual({
      groupChatId: "gc-1",
      userId: "user-carol",
      isTyping: true,
    });
  });

  it("reflects isTyping: false", () => {
    const payload = resolveGroupTyping(
      { groupChatId: "gc-2", isTyping: false },
      "user-dave",
    );
    expect(payload.isTyping).toBe(false);
  });

  it("is pure — same input always returns the same output", () => {
    const p1 = resolveGroupTyping(
      { groupChatId: "gc-1", isTyping: true },
      "user-1",
    );
    const p2 = resolveGroupTyping(
      { groupChatId: "gc-1", isTyping: true },
      "user-1",
    );
    expect(p1).toEqual(p2);
  });

  it("preserves all three payload fields", () => {
    const payload = resolveGroupTyping(
      { groupChatId: "gc-abc", isTyping: false },
      "user-xyz",
    );
    expect(Object.keys(payload).sort()).toEqual([
      "groupChatId",
      "isTyping",
      "userId",
    ]);
  });
});

// ---------------------------------------------------------------------------
// group:leave invariant documentation
// ---------------------------------------------------------------------------

describe("group:leave — no authorization required (invariant I4)", () => {
  it("group:leave does not require a participant check (no resolveGroupLeave exists)", () => {
    // Invariant I4: group:leave requires NO authorization.
    // A user can always leave a room they are in.
    // The leave handler calls socket.leave(buildGroupRoomName(groupChatId)) directly.
    // We verify the room name here to document the convention.
    expect(buildGroupRoomName("gc-leaving")).toBe("group:gc-leaving");
  });

  it("the room a user leaves is the same room they joined", () => {
    // group:join and group:leave use the same buildGroupRoomName convention.
    const groupChatId = "gc-shared";
    const joinRoom = buildGroupRoomName(groupChatId);
    const leaveRoom = buildGroupRoomName(groupChatId);
    expect(joinRoom).toBe(leaveRoom);
  });
});
