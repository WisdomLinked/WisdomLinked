import test from "node:test";
import assert from "node:assert/strict";
import { rcUsernamesWithActiveChatConnection } from "../utils/rocketChatPresence";

test("when statusConnection is set, only online connection counts; offline excludes", () => {
  const usernames = rcUsernamesWithActiveChatConnection([
    { username: "a", status: "online", statusConnection: "online" },
    { username: "b", status: "online", statusConnection: "offline" },
    { username: "c", status: "away", statusConnection: "online" },
  ]);
  assert.deepEqual(new Set(usernames), new Set(["a", "c"]));
});

test("when statusConnection is omitted, falls back to status online (RC list payloads)", () => {
  const usernames = rcUsernamesWithActiveChatConnection([
    { username: "u1", status: "online" },
    { username: "u2", status: "away" },
  ]);
  assert.deepEqual(usernames, ["u1"]);
});

test("ignores rows without username; empty statusConnection falls back to status", () => {
  assert.deepEqual(
    rcUsernamesWithActiveChatConnection([
        { statusConnection: "online" },
        { username: "x", status: "online" },
        { username: "y", statusConnection: "", status: "online" },
    ]),
    ["x", "y"]
  );
});

test("deduplicates usernames", () => {
  const usernames = rcUsernamesWithActiveChatConnection([
    { username: "z", statusConnection: "online" },
    { username: "z", statusConnection: "online" },
  ]);
  assert.deepEqual(usernames, ["z"]);
});

test("excludes users whose latest lastLogin/_updatedAt is older than 30 minutes", () => {
  const now = 1_700_000_000_000;
  const t20 = new Date(now - 20 * 60 * 1000).toISOString();
  const t40 = new Date(now - 40 * 60 * 1000).toISOString();
  const usernames = rcUsernamesWithActiveChatConnection(
    [
      { username: "fresh", status: "online", lastLogin: t20 },
      { username: "stale", status: "online", lastLogin: t40 },
    ],
    now
  );
  assert.deepEqual(usernames, ["fresh"]);
});

test("uses the more recent of lastLogin and _updatedAt for idle cutoff", () => {
  const now = 1_700_000_000_000;
  const oldLogin = new Date(now - 120 * 60 * 1000).toISOString();
  const recentUpdate = new Date(now - 5 * 60 * 1000).toISOString();
  const usernames = rcUsernamesWithActiveChatConnection(
    [{ username: "u", status: "online", lastLogin: oldLogin, _updatedAt: recentUpdate }],
    now
  );
  assert.deepEqual(usernames, ["u"]);
});
