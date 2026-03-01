import { useCallback, useEffect, useState } from "react";
import { useSetAtom } from "jotai";

import { messagesAtom, normalizeDmMessage, normalizeGroupMessage } from "@/atoms/chatAtoms";
import { onlineUsersAtom } from "@/atoms/appAtoms";
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  type DmSendPayload,
  type GroupSendPayload,
  type SendAck,
} from "@/services/socket";

/**
 * Primary socket hook.
 *
 * Responsibilities:
 * - Manages the socket connection lifecycle (connect on mount, disconnect on unmount).
 * - Normalises incoming DM and group messages into the canonical ChatMessage shape
 *   and appends them to `messagesAtom`.
 * - Updates `onlineUsersAtom` on presence events.
 * - Exposes `sendDm` / `sendGroupMessage` helpers that return acknowledgement Promises.
 *
 * MUST be mounted before `usePresence` or `useTypingIndicator` if those hooks
 * rely on an active connection (they call `connectSocket()` which is idempotent).
 */
export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const setMessages = useSetAtom(messagesAtom);
  const setOnlineUsers = useSetAtom(onlineUsersAtom);

  useEffect(() => {
    const socket = connectSocket();

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleDmMessage = (data: Parameters<typeof normalizeDmMessage>[0]) => {
      const msg = normalizeDmMessage(data);
      const key = msg.conversationId ?? "";
      setMessages((prev) => {
        const existing = prev.get(key) ?? [];
        // Deduplicate by id (idempotent append).
        if (existing.some((m) => m.id === msg.id)) {
          return prev;
        }
        const next = new Map(prev);
        next.set(key, [...existing, msg]);
        return next;
      });
    };

    const handleGroupMessage = (data: Parameters<typeof normalizeGroupMessage>[0]) => {
      const msg = normalizeGroupMessage(data);
      const key = msg.groupChatId ?? "";
      setMessages((prev) => {
        const existing = prev.get(key) ?? [];
        if (existing.some((m) => m.id === msg.id)) {
          return prev;
        }
        const next = new Map(prev);
        next.set(key, [...existing, msg]);
        return next;
      });
    };

    const handlePresenceOnline = (data: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.add(data.userId);
        return next;
      });
    };

    const handlePresenceOffline = (data: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("dm:message", handleDmMessage);
    socket.on("group:message", handleGroupMessage);
    socket.on("presence:online", handlePresenceOnline);
    socket.on("presence:offline", handlePresenceOffline);

    // If the socket is already connected before our listeners attached,
    // fire handleConnect() via a microtask so we never call setState
    // synchronously inside the effect body (which triggers cascading renders).
    if (socket.connected) {
      Promise.resolve().then(handleConnect);
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("dm:message", handleDmMessage);
      socket.off("group:message", handleGroupMessage);
      socket.off("presence:online", handlePresenceOnline);
      socket.off("presence:offline", handlePresenceOffline);
      disconnectSocket();
    };
  }, [setMessages, setOnlineUsers]);

  const sendDm = useCallback((payload: DmSendPayload): Promise<SendAck> => {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (socket === null) {
        reject(new Error("Socket is not connected"));
        return;
      }
      socket.emit("dm:send", payload, (ack: SendAck) => {
        resolve(ack);
      });
    });
  }, []);

  const sendGroupMessage = useCallback((payload: GroupSendPayload): Promise<SendAck> => {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (socket === null) {
        reject(new Error("Socket is not connected"));
        return;
      }
      socket.emit("group:send", payload, (ack: SendAck) => {
        resolve(ack);
      });
    });
  }, []);

  return { isConnected, sendDm, sendGroupMessage };
}
