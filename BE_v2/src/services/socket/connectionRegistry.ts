/**
 * In-memory connection registry.
 *
 * Tracks which users are currently connected and which socket IDs belong to
 * each user (supporting multi-tab / multi-device sessions).
 *
 * This module is intentionally pure: no I/O, no side-effects.
 * All invariants can be tested without any external dependencies.
 *
 * Invariants:
 *   1. A userId in `connections` always has a non-empty Set of socket IDs.
 *   2. removeConnection returns `true` iff the user has no remaining
 *      connections after the removal (i.e., fully offline).
 *   3. isOnline(userId) === (getSocketIds(userId) !== undefined).
 */

class ConnectionRegistry {
  /** userId → Set of currently active socketIds for that user. */
  private readonly connections = new Map<string, Set<string>>();

  /**
   * Register a new socket connection for a user.
   * Safe to call multiple times for the same user (multi-tab scenario).
   */
  addConnection(userId: string, socketId: string): void {
    const existing = this.connections.get(userId);
    if (existing !== undefined) {
      existing.add(socketId);
    } else {
      this.connections.set(userId, new Set([socketId]));
    }
  }

  /**
   * Remove a socket connection for a user.
   *
   * @returns `true` if the user is now fully offline (no remaining sockets),
   *          `false` if the user still has at least one active connection.
   */
  removeConnection(userId: string, socketId: string): boolean {
    const existing = this.connections.get(userId);
    if (existing === undefined) {
      // Unknown socket — treat as fully offline (idempotent).
      return true;
    }

    existing.delete(socketId);

    if (existing.size === 0) {
      this.connections.delete(userId);
      return true;
    }

    return false;
  }

  /**
   * Return all active socket IDs for a user, or `undefined` if offline.
   */
  getSocketIds(userId: string): Set<string> | undefined {
    return this.connections.get(userId);
  }

  /** Returns true if the user has at least one active connection. */
  isOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  /** Returns the list of all currently connected user IDs. */
  getOnlineUserIds(): string[] {
    return Array.from(this.connections.keys());
  }
}

/**
 * Singleton instance shared across the socket service.
 *
 * Bounded lifetime: connections are cleaned up on socket disconnect
 * (handled in presenceHandlers). No unbounded growth occurs as long as
 * disconnect events are properly wired.
 */
export const connectionRegistry = new ConnectionRegistry();

// Export class for testing
export { ConnectionRegistry };
