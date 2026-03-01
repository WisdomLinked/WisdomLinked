/**
 * Presence handlers — online/offline broadcast.
 *
 * Wires connect and disconnect events to the connection registry and emits
 * typed presence events to all relevant sockets.
 *
 * Invariants:
 *   - "presence:online" is broadcast to OTHER sockets only when the user
 *     transitions from offline → online (first socket for that user).
 *   - "presence:offline" is broadcast to ALL remaining sockets only when the
 *     user transitions from online → offline (last socket disconnects).
 *   - No broadcasts occur for intermediate connect/disconnect events when
 *     a user already has other active sockets (multi-tab).
 */
import { connectionRegistry } from "./connectionRegistry";
import type { TypedServer, TypedSocket } from "./types";

/**
 * Register presence event handlers for a newly authenticated socket.
 *
 * Call this inside the `io.on("connection", ...)` handler, after auth
 * middleware has populated socket.data.
 */
export function registerPresenceHandlers(
  io: TypedServer,
  socket: TypedSocket,
): void {
  const { userId } = socket.data;

  // Determine whether this user already has an active connection before
  // registering the new one, so we can avoid duplicate presence:online events.
  const wasAlreadyOnline = connectionRegistry.isOnline(userId);
  connectionRegistry.addConnection(userId, socket.id);

  // Only broadcast presence:online when this is the user's first socket.
  // (Multi-tab: subsequent sockets are silent.)
  if (!wasAlreadyOnline) {
    socket.broadcast.emit("presence:online", { userId });
  }

  // Clean up on disconnect — may fire before or after the connection handler
  // for the same socket ID, depending on transport errors.
  socket.on("disconnect", () => {
    const isFullyOffline = connectionRegistry.removeConnection(userId, socket.id);

    // Only broadcast presence:offline when the user has no remaining sockets.
    if (isFullyOffline) {
      // socket is already disconnected; io.emit reaches all *other* clients.
      io.emit("presence:offline", { userId });
    }
  });
}
