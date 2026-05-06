import { describe, expect, it } from "vitest";
import { buildFallbackChatProfile, mergeChatProfile } from "./chatProfileModal";

describe("chatProfileModal utils", () => {
  it("builds role-aware fallback for expert viewer", () => {
    const out = buildFallbackChatProfile({ userId: "u1", username: "Alex", image: "img" }, "expert");
    expect(out).toMatchObject({ _id: "u1", username: "Alex", role: "customer", image: "img" });
  });

  it("builds role-aware fallback for student viewer", () => {
    const out = buildFallbackChatProfile({ userId: "u2", username: "Sam" }, "customer");
    expect(out).toMatchObject({ _id: "u2", username: "Sam", role: "expert" });
  });

  it("prefers API profile values when present", () => {
    const fallback = buildFallbackChatProfile({ userId: "u3", username: "Old" }, "expert");
    const merged = mergeChatProfile(fallback, { username: "New", role: "expert", email: "n@x.com" });
    expect(merged).toMatchObject({ username: "New", role: "expert", email: "n@x.com" });
  });

  it("preserves populated keywords and services arrays from API", () => {
    const fallback = buildFallbackChatProfile({ userId: "u4", username: "X" }, "expert");
    const merged = mergeChatProfile(fallback, {
      keywords: [{ label: "Computer Science", value: "cs" }],
      services: [{ label: "Mentoring", value: "mentoring" }],
    });
    expect(merged.keywords).toHaveLength(1);
    expect(merged.services).toHaveLength(1);
    expect((merged.keywords as any)[0].label).toBe("Computer Science");
  });
});

