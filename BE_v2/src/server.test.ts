/**
 * Server Smoke Test
 *
 * Verifies the Elysia app boots without crashing during route registration.
 * Catches errors like duplicate param names at test time rather than letting
 * them surface only on `bun start`.
 */
import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import { routes } from "./routes";

describe("Server Smoke Test", () => {
  it("should register all routes without crashing", () => {
    const app = new Elysia()
      .get("/health", () => ({ status: "ok" }))
      .use(routes);
    expect(app).toBeDefined();
  });

  it("should respond to GET /health with 200", async () => {
    const app = new Elysia()
      .get("/health", () => ({ status: "ok" }))
      .use(routes);
    const response = await app.handle(
      new Request("http://localhost/health"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });
});
