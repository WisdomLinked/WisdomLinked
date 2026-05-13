import { describe, expect, it } from "vitest";
import { getStatusLabel } from "./ChatHeader";

describe("ChatHeader status label", () => {
  it("shows online directly", () => {
    expect(getStatusLabel("online")).toBe("Online");
  });

  it("keeps Offline visible when showing last seen details", () => {
    const label = getStatusLabel("offline", new Date("2026-05-10T12:00:00Z"));
    expect(label).toMatch(/^Offline - last seen /);
  });
});
