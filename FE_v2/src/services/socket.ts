import { getDefaultStore } from "jotai";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

import { tokenAtom } from "@/atoms/authAtoms";
import { getFrontendEnvironmentConfig } from "@/config/env";

// ── Inbound payload types (Server → Client) ───────────────────────────────────

export interface DmMessage {
  messageId: string;
  conversationId: string;
  author: string;
  content: string;
  type: string;
  fileUrl?: string;
  createdAt: string;
}

export interface DmTypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface GroupMessage {
  messageId: string;
  groupChatId: string;
  author: string;
  content: string;
  type: string;
  fileUrl?: string;
  createdAt: string;
}

export interface GroupTypingEvent {
  groupChatId: string;
  userId: string;
  isTyping: boolean;
}

export interface PresenceEvent {
  userId: string;
}

export interface SocketErrorEvent {
  message: string;
}

// ── Outbound payload types (Client → Server) ──────────────────────────────────

export interface SendAck {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface DmSendPayload {
  conversationId: string;
  content: string;
  type?: string;
}

export interface DmTypingPayload {
  conversationId: string;
  isTyping: boolean;
}

export interface GroupSendPayload {
  groupChatId: string;
  content: string;
  type?: string;
}

export interface GroupTypingPayload {
  groupChatId: string;
  isTyping: boolean;
}

// ── Typed event maps ──────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  "dm:message": (data: DmMessage) => void;
  "dm:typing": (data: DmTypingEvent) => void;
  "group:message": (data: GroupMessage) => void;
  "group:typing": (data: GroupTypingEvent) => void;
  "presence:online": (data: PresenceEvent) => void;
  "presence:offline": (data: PresenceEvent) => void;
  error: (data: SocketErrorEvent) => void;
}

export interface ClientToServerEvents {
  "dm:send": (data: DmSendPayload, ack: (result: SendAck) => void) => void;
  "dm:typing": (data: DmTypingPayload) => void;
  "dm:join": (data: { conversationId: string }) => void;
  "group:send": (data: GroupSendPayload, ack: (result: SendAck) => void) => void;
  "group:typing": (data: GroupTypingPayload) => void;
  "group:join": (data: { groupChatId: string }) => void;
  "group:leave": (data: { groupChatId: string }) => void;
}

// ── Typed socket alias ────────────────────────────────────────────────────────

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ── Module-level singleton ────────────────────────────────────────────────────

let socketInstance: TypedSocket | null = null;

// Read token through the Jotai store (which syncs with the persistence boundary)
// so we never call localStorage directly here.
const store = getDefaultStore();

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the current socket instance, or null if not yet connected. */
export function getSocket(): TypedSocket | null {
  return socketInstance;
}

/**
 * Creates and connects a typed socket singleton.
 * Idempotent: if an already-connected instance exists it is returned unchanged.
 * If a disconnected instance exists it is cleaned up first.
 */
export function connectSocket(): TypedSocket {
  if (socketInstance !== null && socketInstance.connected) {
    return socketInstance;
  }

  const { apiBaseUrl } = getFrontendEnvironmentConfig();
  const baseUrl = apiBaseUrl.replace(/\/$/, "");

  const token = store.get(tokenAtom);
  const auth: Record<string, string> = {};
  if (typeof token === "string" && token.length > 0) {
    auth.token = token;
  }

  // Clean up any stale disconnected instance before creating a new one.
  if (socketInstance !== null) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  const socket: TypedSocket = io(baseUrl, {
    auth,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ["websocket", "polling"],
  });

  socketInstance = socket;
  return socket;
}

/** Disconnects and removes the socket singleton. Safe to call multiple times. */
export function disconnectSocket(): void {
  if (socketInstance !== null) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
