import { atom } from "jotai";
import type { DmMessage, GroupMessage } from "@/services/socket";

// ── Re-export presence atom so consumers can import from one place ────────────
export { onlineUsersAtom } from "@/atoms/appAtoms";

// ── Conversation list types ───────────────────────────────────────────────────

export interface ConversationParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

export interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

// ── Canonical in-memory message type ─────────────────────────────────────────
// This is the single authoritative shape stored in `messagesAtom`.
// All sources (REST API, socket DM events, socket group events) are normalised
// into this shape at the boundary before entering core state.

export type ChatMessageType = "text" | "file" | "system";

export interface ChatMessage {
  /** Stable unique ID (messageId from socket, id from REST). */
  id: string;
  /** Populated for DM messages; null for group messages. */
  conversationId: string | null;
  /** Populated for group messages; null for DM messages. */
  groupChatId: string | null;
  /** String userId of the author. */
  authorId: string;
  content: string;
  type: ChatMessageType;
  fileUrl: string | null;
  createdAt: string;
}

// ── Boundary normalizers (pure functions) ─────────────────────────────────────
// These are the ONLY places where socket payloads are converted to ChatMessage.

function toMessageType(raw: string): ChatMessageType {
  if (raw === "text" || raw === "file" || raw === "system") {
    return raw;
  }
  return "text";
}

export function normalizeDmMessage(data: DmMessage): ChatMessage {
  return {
    id: data.messageId,
    conversationId: data.conversationId,
    groupChatId: null,
    authorId: data.author,
    content: data.content,
    type: toMessageType(data.type),
    fileUrl: data.fileUrl ?? null,
    createdAt: data.createdAt,
  };
}

export function normalizeGroupMessage(data: GroupMessage): ChatMessage {
  return {
    id: data.messageId,
    conversationId: null,
    groupChatId: data.groupChatId,
    authorId: data.author,
    content: data.content,
    type: toMessageType(data.type),
    fileUrl: data.fileUrl ?? null,
    createdAt: data.createdAt,
  };
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

/** List of DM conversations shown in the sidebar. */
export const conversationsAtom = atom<Conversation[]>([]);

/** ID of the currently selected conversation (DM). */
export const activeConversationIdAtom = atom<string | null>(null);

/**
 * Canonical message store.
 * Key: conversationId (DM) or groupChatId (group chat).
 * Value: ordered list of ChatMessage (append-only during a session).
 */
export const messagesAtom = atom<Map<string, ChatMessage[]>>(new Map());

/**
 * Typing users per conversation/group.
 * Key: conversationId or groupChatId.
 * Value: array of userIds currently typing.
 */
export const typingUsersAtom = atom<Map<string, string[]>>(new Map());

/** Unread message counts per conversation/group. */
export const unreadCountAtom = atom<Map<string, number>>(new Map());
