import { describe, expect, it } from "vitest";
import { shouldShowMobileMessenger } from "./mobileChatLayout";

describe("shouldShowMobileMessenger", () => {
  it("returns false when no thread selected", () => {
    expect(shouldShowMobileMessenger(null, null)).toBe(false);
    expect(shouldShowMobileMessenger(undefined, undefined)).toBe(false);
  });

  it("returns true when DM is selected", () => {
    expect(shouldShowMobileMessenger({ userId: "u1" }, null)).toBe(true);
  });

  it("returns true when community/group is selected", () => {
    expect(shouldShowMobileMessenger(null, { groupId: "g1" })).toBe(true);
  });
});

