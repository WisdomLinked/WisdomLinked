/**
 * Group chat Socket.IO handlers.
 *
 * Architecture mirrors dmHandlers.ts exactly:
 *   - Pure resolver functions with injectable DB deps (fully testable).
 *   - Default DB implementations for production use.
 *   - Thin effect handlers bridging resolvers → socket events.
 *   - registerGroupHandlers() is the single public wire-up entry point.
 *
 * Invariants:
 *   I1. A user may only join a group: room if they are listed in GroupChat.participants.
 *   I2. group:message is broadcast to ALL sockets in the room (io.to), including sender.
 *   I3. group:typing is broadcast excluding the sender (socket.to).
 *   I4. group:leave requires no authorization — any authenticated user may leave.
 *   I5. The ack callback is ALWAYS called (either success or error) — no hanging clients.
 *   I6. Every DB/effect failure maps to a typed error result; no silent drops.
 *   I7. Message type is normalised at the event ingress boundary to a valid MessageType.
 */
import { Types } from "mongoose";

import { GroupChatModel } from "../../models/GroupChat";
import { MessageModel } from "../../models/Message";
import type { TypedServer, TypedSocket } from "./types";

// ---------------------------------------------------------------------------
// Room name helper — single definition for the group: room naming convention.
// ---------------------------------------------------------------------------

/** Returns the socket.io room name for a group chat. Pure. */
export function buildGroupRoomName(groupChatId: string): string {
  return `group:${groupChatId}`;
}

// ---------------------------------------------------------------------------
// Injectable dependency types — enables pure-function testing without DB.
// ---------------------------------------------------------------------------

export type GroupParticipantChecker = (
  groupChatId: string,
  userId: string,
) => Promise<boolean>;

export type GroupMessageSaver = (params: {
  groupChatId: string;
  author: string;
  content: string;
  type: string;
}) => Promise<{ messageId: string; createdAt: Date }>;

// ---------------------------------------------------------------------------
// Result types — discriminated unions; no untyped/implicit errors.
// ---------------------------------------------------------------------------

export type GroupJoinResult = { ok: true } | { ok: false; reason: string };

export type GroupSendResult =
  | { ok: true; messageId: string; createdAt: string }
  | { ok: false; error: string };

export interface GroupTypingPayload {
  groupChatId: string;
  userId: string;
  isTyping: boolean;
}

// ---------------------------------------------------------------------------
// Pure resolver functions (injectable deps, deterministic, no socket.io deps).
// ---------------------------------------------------------------------------

/**
 * Verify the user is in GroupChat.participants before joining the room.
 * Returns { ok: true } when authorised; { ok: false, reason } otherwise.
 * DB errors are caught and mapped to { ok: false } — no silent swallows.
 */
export async function resolveGroupJoin(
  groupChatId: string,
  userId: string,
  checkParticipant: GroupParticipantChecker,
): Promise<GroupJoinResult> {
  try {
    const isParticipant = await checkParticipant(groupChatId, userId);
    if (!isParticipant) {
      return { ok: false, reason: "Not authorized to join this group chat" };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Authorization check failed: ${message}` };
  }
}

/**
 * Create a group message in the database.
 * Returns { ok: true, messageId, createdAt } on success or { ok: false, error }.
 * Invariant I5: ack is always called because all paths return a typed result.
 */
export async function resolveGroupSend(
  data: { groupChatId: string; content: string; type: string },
  userId: string,
  saveMessage: GroupMessageSaver,
): Promise<GroupSendResult> {
  try {
    const { messageId, createdAt } = await saveMessage({
      groupChatId: data.groupChatId,
      author: userId,
      content: data.content,
      type: data.type,
    });
    return { ok: true, messageId, createdAt: createdAt.toISOString() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Build the typed typing-indicator payload for a group chat.
 * Pure function — same input always produces the same output (no I/O).
 */
export function resolveGroupTyping(
  data: { groupChatId: string; isTyping: boolean },
  userId: string,
): GroupTypingPayload {
  return {
    groupChatId: data.groupChatId,
    userId,
    isTyping: data.isTyping,
  };
}

// ---------------------------------------------------------------------------
// Default DB implementations (production use only).
// These are NOT exported — tests inject their own mocks into the resolvers.
// ---------------------------------------------------------------------------

async function defaultCheckGroupParticipant(
  groupChatId: string,
  userId: string,
): Promise<boolean> {
  const groupChat = await GroupChatModel.findOne({
    _id: groupChatId,
    participants: userId,
  })
    .lean()
    .exec();
  return groupChat !== null;
}

async function defaultSaveGroupMessage(params: {
  groupChatId: string;
  author: string;
  content: string;
  type: string;
}): Promise<{ messageId: string; createdAt: Date }> {
  const message = await MessageModel.create({
    author: new Types.ObjectId(params.author),
    content: params.content,
    type: params.type,
    groupChatId: new Types.ObjectId(params.groupChatId),
    readBy: [new Types.ObjectId(params.author)],
  });
  return {
    messageId: message._id.toString(),
    createdAt: message.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Ingress normalizer — validates/narrows message type at the event boundary.
// Unknown values default to "text" (safe fallback documented as ingress rule).
// ---------------------------------------------------------------------------

function parseMessageType(raw: string | undefined): "text" | "file" | "system" {
  if (raw === "file" || raw === "system") return raw;
  return "text";
}

// ---------------------------------------------------------------------------
// Effect handlers — thin bridge between pure resolvers and socket events.
// These contain no business logic; all logic lives in the resolver functions.
// ---------------------------------------------------------------------------

async function handleGroupJoin(
  socket: TypedSocket,
  data: { groupChatId: string },
): Promise<void> {
  const result = await resolveGroupJoin(
    data.groupChatId,
    socket.data.userId,
    defaultCheckGroupParticipant,
  );
  if (!result.ok) {
    socket.emit("error", { message: result.reason });
    return;
  }
  await socket.join(buildGroupRoomName(data.groupChatId));
}

async function handleGroupSend(
  io: TypedServer,
  socket: TypedSocket,
  data: { groupChatId: string; content: string; type?: string },
  ack: (res: { success: boolean; messageId?: string; error?: string }) => void,
): Promise<void> {
  const messageType = parseMessageType(data.type);
  const result = await resolveGroupSend(
    {
      groupChatId: data.groupChatId,
      content: data.content,
      type: messageType,
    },
    socket.data.userId,
    defaultSaveGroupMessage,
  );

  if (!result.ok) {
    ack({ success: false, error: result.error });
    return;
  }

  // Broadcast to all participants in the room, including the sender.
  io.to(buildGroupRoomName(data.groupChatId)).emit("group:message", {
    messageId: result.messageId,
    groupChatId: data.groupChatId,
    author: socket.data.userId,
    content: data.content,
    type: messageType,
    createdAt: result.createdAt,
  });

  ack({ success: true, messageId: result.messageId });
}

// ---------------------------------------------------------------------------
// Public registration function.
// ---------------------------------------------------------------------------

/**
 * Register all group chat Socket.IO event handlers for a connected, authenticated socket.
 * Call this inside the io.on("connection", ...) handler after auth middleware
 * has populated socket.data.
 */
export function registerGroupHandlers(io: TypedServer, socket: TypedSocket): void {
  socket.on("group:join", (data) => {
    void handleGroupJoin(socket, data);
  });

  // group:leave requires no authorization — any authenticated user may leave
  // any room (they can only have joined authorised rooms via group:join).
  socket.on("group:leave", (data) => {
    void socket.leave(buildGroupRoomName(data.groupChatId));
  });

  socket.on("group:send", (data, ack) => {
    void handleGroupSend(io, socket, data, ack);
  });

  socket.on("group:typing", (data) => {
    const payload = resolveGroupTyping(data, socket.data.userId);
    // Broadcast typing indicator to room, excluding the sender (socket.to).
    socket.to(buildGroupRoomName(data.groupChatId)).emit("group:typing", payload);
  });
}
