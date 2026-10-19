import test from "node:test";
import assert from "node:assert/strict";

const axios = require("axios");
const { readUnreadSubscriptionsWithHeaders, readUnreadCountsWithHeaders } = require("../services/rocketchat.service");

const HEADERS = { "X-Auth-Token": "t", "X-User-Id": "u" };

/**
 * Fake Rocket.Chat: `subs` is the subscriptions.get list, `counters` maps a room id to its
 * counters `unreads` (or "fail" to make that probe throw).
 */
const withRocketChat = (subs: any[] | "fail", counters: Record<string, number | "fail"> = {}) => {
  const original = axios.get;
  const probed: string[] = [];
  axios.get = async (url: string, config: any) => {
    if (url.endsWith("/subscriptions.get")) {
      if (subs === "fail") throw Object.assign(new Error("down"), { response: { status: 500 } });
      return { data: { update: subs } };
    }
    if (url.endsWith(".counters")) {
      const rid = config?.params?.roomId;
      probed.push(rid);
      const value = counters[rid];
      if (value === "fail") throw Object.assign(new Error("probe failed"), { response: { status: 500 } });
      return { data: { unreads: value ?? 0 } };
    }
    throw new Error(`unexpected GET ${url}`);
  };
  return { probed, restore: () => (axios.get = original) };
};

const dm = (rid: string, unread: number) => ({ rid, t: "d", unread, alert: unread > 0 });
const channel = (rid: string, alert: boolean, unread = 0) => ({ rid, t: "c", unread, alert });

test("default read (the bell) is unchanged: a failed probe still counts that room as 1", async () => {
  const rc = withRocketChat([dm("dm1", 3), channel("c1", true), channel("c2", true)], { c1: 5, c2: "fail" });
  try {
    const out = await readUnreadSubscriptionsWithHeaders(HEADERS);
    assert.equal(out.ok, true);
    assert.deepEqual(out.unreadByRid, { dm1: 3, c1: 5, c2: 1 });
  } finally {
    rc.restore();
  }
});

test("strict read (the email): a failed probe makes the whole count unknown", async () => {
  const rc = withRocketChat([dm("dm1", 3), channel("c1", true)], { c1: "fail" });
  try {
    const out = await readUnreadSubscriptionsWithHeaders(HEADERS, { strict: true });
    assert.equal(out.ok, false);
  } finally {
    rc.restore();
  }
});

test("strict read with every probe answered returns the real counts", async () => {
  const rc = withRocketChat([dm("dm1", 3), channel("c1", true), channel("c2", true)], { c1: 5, c2: 0 });
  try {
    const out = await readUnreadSubscriptionsWithHeaders(HEADERS, { strict: true });
    assert.equal(out.ok, true);
    assert.deepEqual(out.unreadByRid, { dm1: 3, c1: 5 });
  } finally {
    rc.restore();
  }
});

test("onlyRids: rooms outside the set are neither counted nor probed, so their failures cannot block", async () => {
  const rc = withRocketChat(
    [dm("dm1", 3), dm("old-dm", 9), channel("c1", true), channel("stale", true)],
    { c1: 2, stale: "fail" },
  );
  try {
    const out = await readUnreadSubscriptionsWithHeaders(HEADERS, {
      strict: true,
      onlyRids: new Set(["dm1", "c1"]),
    });
    assert.equal(out.ok, true);
    assert.deepEqual(out.unreadByRid, { dm1: 3, c1: 2 });
    assert.deepEqual(rc.probed, ["c1"]);
  } finally {
    rc.restore();
  }
});

test("subscriptions.get failing is unknown in both modes", async () => {
  const rc = withRocketChat("fail");
  try {
    assert.equal((await readUnreadSubscriptionsWithHeaders(HEADERS)).ok, false);
    assert.equal((await readUnreadSubscriptionsWithHeaders(HEADERS, { strict: true })).ok, false);
  } finally {
    rc.restore();
  }
});

test("a read room (no unread, no alert) is not probed and not counted", async () => {
  const rc = withRocketChat([dm("dm1", 0), channel("c1", false)]);
  try {
    const out = await readUnreadSubscriptionsWithHeaders(HEADERS, { strict: true });
    assert.equal(out.ok, true);
    assert.deepEqual(out.unreadByRid, {});
    assert.deepEqual(rc.probed, []);
  } finally {
    rc.restore();
  }
});

test("default read probes at most 5 alert-only rooms and assumes 1 for the rest", async () => {
  const subs = Array.from({ length: 7 }, (_, i) => channel(`c${i}`, true));
  const counters = Object.fromEntries(subs.map((s) => [s.rid, 4]));
  const rc = withRocketChat(subs, counters);
  try {
    const out = await readUnreadSubscriptionsWithHeaders(HEADERS);
    assert.equal(rc.probed.length, 5);
    assert.equal(out.unreadByRid.c5, 1);
    assert.equal(out.unreadByRid.c6, 1);
    assert.equal(out.unreadByRid.c0, 4);
  } finally {
    rc.restore();
  }
});

test("strict read probes up to 25 alert-only rooms", async () => {
  const subs = Array.from({ length: 7 }, (_, i) => channel(`c${i}`, true));
  const counters = Object.fromEntries(subs.map((s) => [s.rid, 4]));
  const rc = withRocketChat(subs, counters);
  try {
    const out = await readUnreadSubscriptionsWithHeaders(HEADERS, { strict: true });
    assert.equal(rc.probed.length, 7);
    assert.equal(out.unreadByRid.c6, 4);
  } finally {
    rc.restore();
  }
});

test("the email's count: unknown (null) when a probe for a counted room fails", async () => {
  const rc = withRocketChat([dm("dm1", 3), channel("c1", true)], { c1: "fail" });
  try {
    assert.equal(await readUnreadCountsWithHeaders(HEADERS, new Set(["dm1", "c1"])), null);
  } finally {
    rc.restore();
  }
});

test("the email's count: real counts for the counted rooms only", async () => {
  const rc = withRocketChat([dm("dm1", 3), dm("other", 8), channel("c1", true)], { c1: 6 });
  try {
    assert.deepEqual(await readUnreadCountsWithHeaders(HEADERS, new Set(["dm1", "c1"])), { dm1: 3, c1: 6 });
  } finally {
    rc.restore();
  }
});

test("the email's count: null when Rocket.Chat cannot list subscriptions", async () => {
  const rc = withRocketChat("fail");
  try {
    assert.equal(await readUnreadCountsWithHeaders(HEADERS, new Set(["dm1"])), null);
  } finally {
    rc.restore();
  }
});
