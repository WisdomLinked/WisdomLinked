import { useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";

import { onlineUsersAtom } from "@/atoms/appAtoms";
import { connectSocket } from "@/services/socket";
import type { PresenceEvent } from "@/services/socket";

/**
 * Tracks user presence by listening for `presence:online` / `presence:offline`
 * socket events and maintaining `onlineUsersAtom`.
 *
 * Returns `isOnline(userId)` — a stable callback that reads from the atom.
 *
 * Note: This hook attaches socket event listeners independently of `useSocket`.
 * It calls `connectSocket()` (idempotent), so it can be used alongside or
 * without `useSocket`.  Lifecycle (disconnection) is owned by `useSocket`.
 */
export function usePresence() {
  const onlineUsers = useAtomValue(onlineUsersAtom);
  const setOnlineUsers = useSetAtom(onlineUsersAtom);

  useEffect(() => {
    const socket = connectSocket();

    const handleOnline = (data: PresenceEvent) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.add(data.userId);
        return next;
      });
    };

    const handleOffline = (data: PresenceEvent) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    };

    socket.on("presence:online", handleOnline);
    socket.on("presence:offline", handleOffline);

    return () => {
      socket.off("presence:online", handleOnline);
      socket.off("presence:offline", handleOffline);
      // Do NOT call disconnectSocket() here — lifecycle is owned by useSocket.
    };
  }, [setOnlineUsers]);

  const isOnline = useCallback(
    (userId: string): boolean => onlineUsers.has(userId),
    [onlineUsers],
  );

  return { isOnline };
}
