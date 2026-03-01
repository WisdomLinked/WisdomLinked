/**
 * Socket.IO server initialization.
 *
 * Single entry point for the socket service.  Call initializeSocketServer()
 * once after the HTTP server starts listening, passing Elysia's server handle.
 *
 * At the type boundary, Bun.Server (returned by app.server) is structurally
 * compatible with Node's http.Server for socket.io's purposes — socket.io
 * 4.7.5+ added Bun support.  We validate the argument at the boundary with a
 * type guard rather than using an unsafe cast.
 *
 * Exported:
 *   initializeSocketServer(httpServer: unknown): TypedServer
 */
import { Server } from "socket.io";

import { registerDmHandlers } from "./dmHandlers";
import { registerGroupHandlers } from "./groupHandlers";
import { registerPresenceHandlers } from "./presenceHandlers";
import { socketAuthMiddleware } from "./socketAuth";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  TypedServer,
} from "./types";

// ---------------------------------------------------------------------------
// Effect boundary: validate the server argument before handing it to socket.io.
//
// socket.io's constructor accepts http.Server / https.Server / http2 servers.
// Bun.Server satisfies these requirements at runtime via Bun's Node.js compat
// layer (socket.io ≥ 4.7.5).  We narrow `unknown` to `http.Server` here so
// the rest of the module is fully typed.
// ---------------------------------------------------------------------------
function isSocketIoCompatibleServer(
  value: unknown,
): value is import("node:http").Server {
  return (
    value !== null &&
    typeof value === "object" &&
    "on" in (value as object) &&
    typeof (value as Record<string, unknown>)["on"] === "function"
  );
}

/**
 * Create and configure the Socket.IO server, attaching it to the provided
 * HTTP-compatible server handle.
 *
 * @param httpServer - The HTTP server to attach to.  Pass `app.server` from
 *   Elysia (Bun.Server is compatible at runtime).  Throws if the argument is
 *   not a server-shaped object.
 * @returns The initialised, running TypedServer instance.
 */
export function initializeSocketServer(httpServer: unknown): TypedServer {
  if (!isSocketIoCompatibleServer(httpServer)) {
    throw new Error(
      "initializeSocketServer: argument is not a compatible HTTP server object",
    );
  }

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  // Authenticate every connection before it reaches the application layer.
  io.use((socket, next) => void socketAuthMiddleware(socket, next));

  io.on("connection", (socket) => {
    console.log(
      `🔌 Socket connected: ${socket.id} (user: ${socket.data.userId})`,
    );

    registerPresenceHandlers(io, socket);
    registerDmHandlers(io, socket);
    registerGroupHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(
        `🔌 Socket disconnected: ${socket.id} (reason: ${reason})`,
      );
    });
  });

  return io;
}

// Re-export types so consumers can import from the service root.
export type { TypedServer, TypedSocket } from "./types";
