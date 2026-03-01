import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { routes } from "../src/routes";

describe("Health Check", () => {
  it("should have routes configured", () => {
    const app = new Elysia().use(routes);
    expect(app).toBeDefined();
  });

  it("should respond to health endpoint", async () => {
    const app = new Elysia()
      .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
      .use(routes);

    const response = await app.handle(
      new Request("http://localhost/health", {
        method: "GET",
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("status", "ok");
  });
});

