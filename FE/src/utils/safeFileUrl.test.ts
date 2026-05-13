import { afterEach, describe, expect, it } from "vitest";
import { resolveSafeChatFileUrl } from "./safeFileUrl";

describe("resolveSafeChatFileUrl", () => {
  const originalServer = process.env.REACT_APP_SERVER_URL;

  afterEach(() => {
    if (originalServer === undefined) delete process.env.REACT_APP_SERVER_URL;
    else process.env.REACT_APP_SERVER_URL = originalServer;
  });

  it("allows relative URLs and expected API host URLs", () => {
    process.env.REACT_APP_SERVER_URL = "https://api.wisdomlinked.com";
    expect(resolveSafeChatFileUrl("/uploads/a.pdf")).toBe("/uploads/a.pdf");
    expect(resolveSafeChatFileUrl("https://api.wisdomlinked.com/uploads/a.pdf")).toBe(
      "https://api.wisdomlinked.com/uploads/a.pdf",
    );
  });

  it("allows DigitalOcean Spaces URLs", () => {
    expect(resolveSafeChatFileUrl("https://wisdomlinked-store.nyc3.digitaloceanspaces.com/chat/a.pdf")).toBe(
      "https://wisdomlinked-store.nyc3.digitaloceanspaces.com/chat/a.pdf",
    );
  });

  it("rejects javascript/data URLs and unknown hosts", () => {
    expect(resolveSafeChatFileUrl("javascript:alert(1)")).toBeNull();
    expect(resolveSafeChatFileUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(resolveSafeChatFileUrl("https://evil.example/file.pdf")).toBeNull();
  });
});
