/**
 * DM handler resolver tests.
 *
 * These tests exercise the pure resolver functions exported from dmHandlers.ts.
 * No socket.io server, no real database, no network I/O.
 *
 * Invariants asserted:
 *   - resolveDmJoin returns { ok: true } iff checkParticipant returns true.
 *   - resolveDmJoin returns { ok: false } on unauthorized access or DB error.
 *   - resolveDmSend creates a message, updates lastMessage, and returns a
 *     well-formed result on success.
 *   - resolveDmSend returns { ok: false } when saveMessage or updateLastMessage throw.
 *   - resolveDmTyping is pure: same input → same output, every time.
 *   - buildDmRoomName encodes the canonical dm: room naming convention.
 *
 * Test strategy: mock all DB dependencies via the injectable function types.
 * No TypedSocket mocks needed — socket effects are entirely in the thin wrappers,
 * not in the resolvers.
 */
import { describe, expect, it } from "bun:test";

import {
  buildDmRoomName,
  resolveDmJoin,
  resolveDmSend,
  resolveDmTyping,
  type ConversationLastMessageUpdater,
  type ConversationParticipantChecker,
  type DmMessageSaver,
} from "../../../src/services/socket/dmHandlers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_DATE = new Date("2026-01-15T12:00:00.000Z");

function makeSaver(
  result: { messageId: string; createdAt: Date } = {
    messageId: "msg-default",
    createdAt: FIXED_DATE,
  },
): DmMessageSaver {
  return async () => result;
}

function makeUpdater(): ConversationLastMessageUpdater {
  return async () => undefined;
}

// ---------------------------------------------------------------------------
// buildDmRoomName
// ---------------------------------------------------------------------------

describe("buildDmRoomName", () => {
  it("returns dm:{conversationId}", () => {
    expect(buildDmRoomName("conv-123")).toBe("dm:conv-123");
  });

  it("preserves the exact conversationId string", () => {
    const id = "507f1f77bcf86cd799439011";
    expect(buildDmRoomName(id)).toBe(`dm:${id}`);
  });

  it("is pure — same input always returns the same output", () => {
    expect(buildDmRoomName("conv-abc")).toBe(buildDmRoomName("conv-abc"));
  });
});

// ---------------------------------------------------------------------------
// resolveDmJoin — authorization
// ---------------------------------------------------------------------------

describe("resolveDmJoin — authorization", () => {
  it("returns { ok: true } when user IS a participant", async () => {
    const checker: ConversationParticipantChecker = async () => true;
    const result = await resolveDmJoin("conv-1", "user-1", checker);
    expect(result.ok).toBe(true);
  });

  it("returns { ok: false } with reason when user is NOT a participant", async () => {
    const checker: ConversationParticipantChecker = async () => false;
    const result = await resolveDmJoin("conv-1", "user-1", checker);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Not authorized");
    }
  });

  it("passes the exact conversationId to the checker", async () => {
    const captured: string[] = [];
    const checker: ConversationParticipantChecker = async (convId) => {
      captured.push(convId);
      return true;
    };
    await resolveDmJoin("conv-target", "user-1", checker);
    expect(captured).toEqual(["conv-target"]);
  });

  it("passes the exact userId to the checker", async () => {
    const captured: string[] = [];
    const checker: ConversationParticipantChecker = async (_convId, userId) => {
      captured.push(userId);
      return true;
    };
    await resolveDmJoin("conv-1", "user-target", checker);
    expect(captured).toEqual(["user-target"]);
  });

  it("returns { ok: false } when checker throws (DB error)", async () => {
    const checker: ConversationParticipantChecker = async () => {
      throw new Error("DB connection lost");
    };
    const result = await resolveDmJoin("conv-1", "user-1", checker);
    expect(result.ok).toBe(false);
  });

  it("includes the thrown error message in the reason", async () => {
    const checker: ConversationParticipantChecker = async () => {
      throw new Error("timeout after 5000ms");
    };
    const result = await resolveDmJoin("conv-1", "user-1", checker);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("timeout after 5000ms");
    }
  });

  it("handles non-Error thrown values gracefully", async () => {
    const checker: ConversationParticipantChecker = async () => {
      throw "string error";
    };
    const result = await resolveDmJoin("conv-1", "user-1", checker);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveDmJoin — determinism (replay property)
// ---------------------------------------------------------------------------

describe("resolveDmJoin — determinism", () => {
  it("returns the same result when called twice with the same inputs", async () => {
    const checker: ConversationParticipantChecker = async () => true;
    const r1 = await resolveDmJoin("conv-1", "user-1", checker);
    const r2 = await resolveDmJoin("conv-1", "user-1", checker);
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// resolveDmSend — message creation + broadcast data
// ---------------------------------------------------------------------------

describe("resolveDmSend — success path", () => {
  it("returns { ok: true } with the messageId from saver", async () => {
    const saver = makeSaver({ messageId: "msg-xyz", createdAt: FIXED_DATE });
    const result = await resolveDmSend(
      { conversationId: "conv-1", content: "hello", type: "text" },
      "user-1",
      saver,
      makeUpdater(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toBe("msg-xyz");
    }
  });

  it("returns createdAt as an ISO string", async () => {
    const saver = makeSaver({
      messageId: "msg-1",
      createdAt: new Date("2026-03-01T09:30:00.000Z"),
    });
    const result = await resolveDmSend(
      { conversationId: "conv-1", content: "hi", type: "text" },
      "user-1",
      saver,
      makeUpdater(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.createdAt).toBe("2026-03-01T09:30:00.000Z");
    }
  });

  it("passes the correct params to saveMessage", async () => {
    const captured: Parameters<DmMessageSaver>[0][] = [];
    const saver: DmMessageSaver = async (params) => {
      captured.push(params);
      return { messageId: "msg-1", createdAt: FIXED_DATE };
    };

    await resolveDmSend(
      { conversationId: "conv-abc", content: "test content", type: "file" },
      "user-xyz",
      saver,
      makeUpdater(),
    );

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({
      conversationId: "conv-abc",
      author: "user-xyz",
      content: "test content",
      type: "file",
    });
  });

  it("calls updateLastMessage with conversationId and the new messageId", async () => {
    const updaterCalls: Array<{ conversationId: string; messageId: string }> =
      [];
    const updater: ConversationLastMessageUpdater = async (convId, msgId) => {
      updaterCalls.push({ conversationId: convId, messageId: msgId });
    };
    const saver = makeSaver({ messageId: "msg-fresh", createdAt: FIXED_DATE });

    await resolveDmSend(
      { conversationId: "conv-target", content: "hi", type: "text" },
      "user-1",
      saver,
      updater,
    );

    expect(updaterCalls).toHaveLength(1);
    expect(updaterCalls[0]).toEqual({
      conversationId: "conv-target",
      messageId: "msg-fresh",
    });
  });
});

describe("resolveDmSend — error paths", () => {
  it("returns { ok: false } when saveMessage throws", async () => {
    const saver: DmMessageSaver = async () => {
      throw new Error("MongoDB write failed");
    };
    const result = await resolveDmSend(
      { conversationId: "conv-1", content: "hi", type: "text" },
      "user-1",
      saver,
      makeUpdater(),
    );
    expect(result.ok).toBe(false);
  });

  it("includes the saveMessage error message in the result", async () => {
    const saver: DmMessageSaver = async () => {
      throw new Error("disk full");
    };
    const result = await resolveDmSend(
      { conversationId: "conv-1", content: "hi", type: "text" },
      "user-1",
      saver,
      makeUpdater(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("disk full");
    }
  });

  it("returns { ok: false } when updateLastMessage throws", async () => {
    const updater: ConversationLastMessageUpdater = async () => {
      throw new Error("update failed");
    };
    const result = await resolveDmSend(
      { conversationId: "conv-1", content: "hi", type: "text" },
      "user-1",
      makeSaver(),
      updater,
    );
    expect(result.ok).toBe(false);
  });

  it("does NOT call updateLastMessage when saveMessage throws", async () => {
    let updaterCalled = false;
    const saver: DmMessageSaver = async () => {
      throw new Error("save failed");
    };
    const updater: ConversationLastMessageUpdater = async () => {
      updaterCalled = true;
    };

    await resolveDmSend(
      { conversationId: "conv-1", content: "hi", type: "text" },
      "user-1",
      saver,
      updater,
    );

    expect(updaterCalled).toBe(false);
  });

  it("handles non-Error thrown values gracefully", async () => {
    const saver: DmMessageSaver = async () => {
      throw 42;
    };
    const result = await resolveDmSend(
      { conversationId: "conv-1", content: "hi", type: "text" },
      "user-1",
      saver,
      makeUpdater(),
    );
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveDmTyping — pure function
// ---------------------------------------------------------------------------

describe("resolveDmTyping", () => {
  it("returns the correct DmTypingPayload", () => {
    const payload = resolveDmTyping(
      { conversationId: "conv-1", isTyping: true },
      "user-alice",
    );
    expect(payload).toEqual({
      conversationId: "conv-1",
      userId: "user-alice",
      isTyping: true,
    });
  });

  it("reflects isTyping: false", () => {
    const payload = resolveDmTyping(
      { conversationId: "conv-2", isTyping: false },
      "user-bob",
    );
    expect(payload.isTyping).toBe(false);
  });

  it("is pure — same input always returns the same output", () => {
    const p1 = resolveDmTyping(
      { conversationId: "conv-1", isTyping: true },
      "user-1",
    );
    const p2 = resolveDmTyping(
      { conversationId: "conv-1", isTyping: true },
      "user-1",
    );
    expect(p1).toEqual(p2);
  });

  it("preserves all three payload fields", () => {
    const payload = resolveDmTyping(
      { conversationId: "conv-abc", isTyping: false },
      "user-xyz",
    );
    expect(Object.keys(payload).sort()).toEqual([
      "conversationId",
      "isTyping",
      "userId",
    ]);
  });
});
