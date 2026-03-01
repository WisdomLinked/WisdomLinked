/**
 * DM (direct message) Socket.IO handlers.
 *
 * Architecture:
 *   - Pure resolver functions (resolveDmJoin, resolveDmSend, resolveDmTyping)
 *     accept injected DB dependencies and return typed discriminated-union
 *     results. No socket.io imports — fully testable with plain mocks.
 *   - Default DB implementations close over the Mongoose models and are
 *     used in production registration.
 *   - Thin effect handlers (handleDmJoin, handleDmSend) bridge resolvers →
 *     socket events; they contain no logic of their own.
 *   - registerDmHandlers() is the single public wire-up entry point.
 *
 * Invariants:
 *   I1. A user may only join a dm: room if they are listed in Conversation.participants.
 *   I2. dm:message is broadcast to ALL sockets in the room (io.to), including sender.
 *   I3. dm:typing is broadcast excluding the sender (socket.to).
 *   I4. The ack callback is ALWAYS called (either success or error) — no hanging clients.
 *   I5. Every DB/effect failure maps to a typed error result; no silent drops.
 *   I6. Message type is normalised at the event ingress boundary to a valid MessageType.
 */
import { Types } from "mongoose";

import { ConversationModel } from "../../models/Conversation";
import { MessageModel } from "../../models/Message";
import type { TypedServer, TypedSocket } from "./types";

// ---------------------------------------------------------------------------
// Room name helper — single definition for the dm: room naming convention.
// ---------------------------------------------------------------------------

/** Returns the socket.io room name for a DM conversation. Pure. */
export function buildDmRoomName(conversationId: string): string {
  return `dm:${conversationId}`;
}

// ---------------------------------------------------------------------------
// Injectable dependency types — enables pure-function testing without DB.
// ---------------------------------------------------------------------------

export type ConversationParticipantChecker = (
  conversationId: string,
  userId: string,
) => Promise<boolean>;

export type DmMessageSaver = (params: {
  conversationId: string;
  author: string;
  content: string;
  type: string;
}) => Promise<{ messageId: string; createdAt: Date }>;

export type ConversationLastMessageUpdater = (
  conversationId: string,
  messageId: string,
) => Promise<void>;

// ---------------------------------------------------------------------------
// Result types — discriminated unions; no untyped/implicit errors.
// ---------------------------------------------------------------------------

export type DmJoinResult = { ok: true } | { ok: false; reason: string };

export type DmSendResult =
  | { ok: true; messageId: string; createdAt: string }
  | { ok: false; error: string };

export interface DmTypingPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

// ---------------------------------------------------------------------------
// Pure resolver functions (injectable deps, deterministic, no socket.io deps).
// ---------------------------------------------------------------------------

/**
 * Verify the user is a participant in the given Conversation before joining.
 * Returns { ok: true } when authorised; { ok: false, reason } otherwise.
 * DB errors are caught and mapped to { ok: false } — no silent swallows.
 */
export async function resolveDmJoin(
  conversationId: string,
  userId: string,
  checkParticipant: ConversationParticipantChecker,
): Promise<DmJoinResult> {
  try {
    const isParticipant = await checkParticipant(conversationId, userId);
    if (!isParticipant) {
      return { ok: false, reason: "Not authorized to join this conversation" };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Authorization check failed: ${message}` };
  }
}

/**
 * Create a DM message and update the conversation's lastMessage pointer.
 * Returns { ok: true, messageId, createdAt } on success or { ok: false, error }.
 * Invariant I4: ack is always called because all paths return a typed result.
 */
export async function resolveDmSend(
  data: { conversationId: string; content: string; type: string },
  userId: string,
  saveMessage: DmMessageSaver,
  updateLastMessage: ConversationLastMessageUpdater,
): Promise<DmSendResult> {
  try {
    const { messageId, createdAt } = await saveMessage({
      conversationId: data.conversationId,
      author: userId,
      content: data.content,
      type: data.type,
    });
    await updateLastMessage(data.conversationId, messageId);
    return { ok: true, messageId, createdAt: createdAt.toISOString() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Build the typed typing-indicator payload.
 * Pure function — same input always produces the same output (no I/O).
 */
export function resolveDmTyping(
  data: { conversationId: string; isTyping: boolean },
  userId: string,
): DmTypingPayload {
  return {
    conversationId: data.conversationId,
    userId,
    isTyping: data.isTyping,
  };
}

// ---------------------------------------------------------------------------
// Default DB implementations (production use only).
// These are NOT exported — tests inject their own mocks into the resolvers.
// ---------------------------------------------------------------------------

async function defaultCheckConversationParticipant(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    participants: userId,
  })
    .lean()
    .exec();
  return conversation !== null;
}

async function defaultSaveDmMessage(params: {
  conversationId: string;
  author: string;
  content: string;
  type: string;
}): Promise<{ messageId: string; createdAt: Date }> {
  const message = await MessageModel.create({
    author: new Types.ObjectId(params.author),
    content: params.content,
    type: params.type,
    conversationId: new Types.ObjectId(params.conversationId),
    readBy: [],
  });
  return {
    messageId: message._id.toString(),
    createdAt: message.createdAt,
  };
}

async function defaultUpdateConversationLastMessage(
  conversationId: string,
  messageId: string,
): Promise<void> {
  await ConversationModel.updateOne(
    { _id: conversationId },
    { $set: { lastMessage: messageId } },
  ).exec();
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

async function handleDmJoin(
  socket: TypedSocket,
  data: { conversationId: string },
): Promise<void> {
  const result = await resolveDmJoin(
    data.conversationId,
    socket.data.userId,
    defaultCheckConversationParticipant,
  );
  if (!result.ok) {
    socket.emit("error", { message: result.reason });
    return;
  }
  await socket.join(buildDmRoomName(data.conversationId));
}

async function handleDmSend(
  io: TypedServer,
  socket: TypedSocket,
  data: { conversationId: string; content: string; type?: string },
  ack: (res: { success: boolean; messageId?: string; error?: string }) => void,
): Promise<void> {
  const messageType = parseMessageType(data.type);
  const result = await resolveDmSend(
    {
      conversationId: data.conversationId,
      content: data.content,
      type: messageType,
    },
    socket.data.userId,
    defaultSaveDmMessage,
    defaultUpdateConversationLastMessage,
  );

  if (!result.ok) {
    ack({ success: false, error: result.error });
    return;
  }

  // Broadcast to all participants in the room, including the sender.
  io.to(buildDmRoomName(data.conversationId)).emit("dm:message", {
    messageId: result.messageId,
    conversationId: data.conversationId,
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
 * Register all DM Socket.IO event handlers for a connected, authenticated socket.
 * Call this inside the io.on("connection", ...) handler after auth middleware
 * has populated socket.data.
 */
export function registerDmHandlers(io: TypedServer, socket: TypedSocket): void {
  socket.on("dm:join", (data) => {
    void handleDmJoin(socket, data);
  });

  socket.on("dm:send", (data, ack) => {
    void handleDmSend(io, socket, data, ack);
  });

  socket.on("dm:typing", (data) => {
    const payload = resolveDmTyping(data, socket.data.userId);
    // Broadcast typing indicator to room, excluding the sender (socket.to).
    socket.to(buildDmRoomName(data.conversationId)).emit("dm:typing", payload);
  });
}
