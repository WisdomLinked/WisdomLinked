import { describe, expect, it } from "vitest";
import { buildOnlineUserIdSet, hasOnlineUserId } from "./onlinePresence";

describe("onlinePresence", () => {
  it("collects ids from common online user shapes", () => {
    const set = buildOnlineUserIdSet([
      { userId: "u1" },
      { id: "u2" },
      { _id: "u3" },
      { user: { _id: "u4" } },
      { user: { id: "u5" } },
    ]);
    expect(set.has("u1")).toBe(true);
    expect(set.has("u2")).toBe(true);
    expect(set.has("u3")).toBe(true);
    expect(set.has("u4")).toBe(true);
    expect(set.has("u5")).toBe(true);
  });

  it("ignores empty ids and checks membership safely", () => {
    const set = buildOnlineUserIdSet([{ userId: "" }, {}, null]);
    expect(set.size).toBe(0);
    expect(hasOnlineUserId(set, "u1")).toBe(false);
    set.add("u9");
    expect(hasOnlineUserId(set, "u9")).toBe(true);
    expect(hasOnlineUserId(set, "")).toBe(false);
  });
});

