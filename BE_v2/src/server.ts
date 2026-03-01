import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { connectToDatabase } from "./config/database";
import { getBackendEnvironmentConfig } from "./config/env";
import { seedAdminUser } from "./models/User";
import { routes } from "./routes";
import { logError } from "./middlewares/logger";
import { initializeSocketServer } from "./services/socket";

const { port: PORT } = getBackendEnvironmentConfig();

async function startServer() {
  try {
    console.log("🚀 Starting WisdomLinked Backend...");

    // Connect to database
    await connectToDatabase();

    // Seed admin user
    await seedAdminUser();

    // Create Elysia app
    const app = new Elysia()
      .use(
        cors({
          origin: true,
          credentials: true,
          allowedHeaders: ["Content-Type", "Authorization"],
        })
      )
      .onError(async ({ code, error, set, path }) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        console.error(`[Error] ${code} at ${path}:`, errorMessage);
        
        // Log error to database
        await logError(`${code}: ${errorMessage}`, {
          path,
          code,
          stack: errorStack,
        });

        if (code === "NOT_FOUND") {
          set.status = 404;
          return { error: "Not Found" };
        }

        if (code === "VALIDATION") {
          set.status = 400;
          return { error: "Validation Error", message: errorMessage };
        }

        // Default error response
        if (!set.status || set.status === 200) {
          set.status = 500;
        }

        return {
          error: errorMessage || "Internal Server Error",
          code,
        };
      })
      .get("/health", () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
      }))
      .use(routes)
      .listen({
        port: PORT,
        hostname: "0.0.0.0",
      });

    console.log(`✅ Backend server running at http://${app.server?.hostname}:${app.server?.port}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 API endpoints: http://localhost:${PORT}/api/v1/...`);

    // Attach Socket.IO to the running Bun server handle.
    // Bun.Server is compatible with socket.io ≥ 4.7.5 at runtime.
    const server = app.server;
    if (server) {
      initializeSocketServer(server);
      console.log("🔌 Socket.IO server initialized");
    }
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

