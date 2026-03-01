/**
 * Socket.IO typed event maps and per-socket data.
 *
 * These interfaces are the single source of truth for all Socket.IO events.
 * Every event that crosses the socket boundary MUST be declared here.
 *
 * Generic parameter positions for Server<L, E, S, D>:
 *   L = ListenEvents (client→server)
 *   E = EmitEvents   (server→client)
 *   S = ServerSideEvents (inter-server adapter)
 *   D = SocketData (per-socket metadata)
 */
import type { Server, Socket } from "socket.io";

// ---------------------------------------------------------------------------
// Server → Client events
// ---------------------------------------------------------------------------
export interface ServerToClientEvents {
  "dm:message": (data: {
    messageId: string;
    conversationId: string;
    author: string;
    content: string;
    type: string;
    fileUrl?: string;
    createdAt: string;
  }) => void;

  "dm:typing": (data: {
    conversationId: string;
    userId: string;
    isTyping: boolean;
  }) => void;

  "group:message": (data: {
    messageId: string;
    groupChatId: string;
    author: string;
    content: string;
    type: string;
    fileUrl?: string;
    createdAt: string;
  }) => void;

  "group:typing": (data: {
    groupChatId: string;
    userId: string;
    isTyping: boolean;
  }) => void;

  "presence:online": (data: { userId: string }) => void;

  "presence:offline": (data: { userId: string }) => void;

  error: (data: { message: string }) => void;
}

// ---------------------------------------------------------------------------
// Client → Server events
// ---------------------------------------------------------------------------
export interface ClientToServerEvents {
  "dm:send": (
    data: { conversationId: string; content: string; type?: string },
    ack: (res: {
      success: boolean;
      messageId?: string;
      error?: string;
    }) => void,
  ) => void;

  "dm:typing": (data: {
    conversationId: string;
    isTyping: boolean;
  }) => void;

  "dm:join": (data: { conversationId: string }) => void;

  "group:send": (
    data: { groupChatId: string; content: string; type?: string },
    ack: (res: {
      success: boolean;
      messageId?: string;
      error?: string;
    }) => void,
  ) => void;

  "group:typing": (data: {
    groupChatId: string;
    isTyping: boolean;
  }) => void;

  "group:join": (data: { groupChatId: string }) => void;

  "group:leave": (data: { groupChatId: string }) => void;
}

// ---------------------------------------------------------------------------
// Per-socket metadata — populated by the auth middleware on every connection.
// ---------------------------------------------------------------------------
export interface SocketData {
  userId: string;
  username: string;
  email: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Convenience type aliases used across the socket service.
// Record<string, never> as InterServerEvents = no cross-server events.
// ---------------------------------------------------------------------------
export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
