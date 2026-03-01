import { useCallback, useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";

import { typingUsersAtom } from "@/atoms/chatAtoms";
import { connectSocket, getSocket } from "@/services/socket";
import type { DmTypingEvent, GroupTypingEvent } from "@/services/socket";

const TYPING_DEBOUNCE_MS = 300;

// ── Context discriminant ──────────────────────────────────────────────────────

export type TypingContext =
  | { kind: "dm"; conversationId: string }
  | { kind: "group"; groupChatId: string };

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages typing indicators for a single conversation or group chat.
 *
 * - `typingUsers`: array of userIds currently typing in this context.
 * - `handleTyping`: call this on every keystroke; it debounces the socket emit.
 *
 * @param context - discriminated union identifying the DM or group chat.
 */
export function useTypingIndicator(context: TypingContext) {
  const [typingUsers, setLocalTypingUsers] = useState<string[]>([]);
  const setGlobalTypingUsers = useSetAtom(typingUsersAtom);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable identifiers extracted from the discriminated union so they can be
  // used safely in dependency arrays.
  const contextKind = context.kind;
  const contextKey =
    context.kind === "dm" ? context.conversationId : context.groupChatId;

  // ── Incoming typing events ────────────────────────────────────────────────

  useEffect(() => {
    const socket = connectSocket();

    const applyTypingState = (userId: string, isTyping: boolean) => {
      const updater = (prev: string[]) => {
        if (isTyping) {
          return prev.includes(userId) ? prev : [...prev, userId];
        }
        return prev.filter((id) => id !== userId);
      };

      setLocalTypingUsers(updater);
      setGlobalTypingUsers((prevMap) => {
        const current = prevMap.get(contextKey) ?? [];
        const updated = updater(current);
        const next = new Map(prevMap);
        next.set(contextKey, updated);
        return next;
      });
    };

    if (contextKind === "dm") {
      const handleDmTyping = (data: DmTypingEvent) => {
        if (data.conversationId !== contextKey) return;
        applyTypingState(data.userId, data.isTyping);
      };
      socket.on("dm:typing", handleDmTyping);
      return () => {
        socket.off("dm:typing", handleDmTyping);
      };
    } else {
      const handleGroupTyping = (data: GroupTypingEvent) => {
        if (data.groupChatId !== contextKey) return;
        applyTypingState(data.userId, data.isTyping);
      };
      socket.on("group:typing", handleGroupTyping);
      return () => {
        socket.off("group:typing", handleGroupTyping);
      };
    }
  }, [contextKind, contextKey, setGlobalTypingUsers]);

  // ── Outgoing typing events (debounced) ────────────────────────────────────

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      const socket = getSocket();
      if (socket === null) return;

      if (contextKind === "dm") {
        socket.emit("dm:typing", { conversationId: contextKey, isTyping });
      } else {
        socket.emit("group:typing", { groupChatId: contextKey, isTyping });
      }
    },
    [contextKind, contextKey],
  );

  /**
   * Call this handler on every input keystroke.
   * It emits `isTyping: true` immediately, then emits `isTyping: false`
   * after `TYPING_DEBOUNCE_MS` of silence.
   */
  const handleTyping = useCallback(() => {
    emitTyping(true);

    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      emitTyping(false);
      debounceRef.current = null;
    }, TYPING_DEBOUNCE_MS);
  }, [emitTyping]);

  // Clear the timeout on unmount to prevent state updates on an unmounted component.
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { typingUsers, handleTyping };
}
