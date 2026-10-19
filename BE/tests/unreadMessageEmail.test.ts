import test from "node:test";
import assert from "node:assert/strict";

import {
  decideUnreadEmail,
  countableRoomIds,
  totalUnread,
  isUnreadEmailRecipient,
  UNREAD_EMAIL_IDLE_MS,
  CHAT_SEEN_THROTTLE_MS,
  UNREAD_EMAIL_ROLES,
  UNREAD_EMAIL_RETRY_MS,
} from "../utils/unreadMessageEmail";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);
/** Activation long ago unless a test is about activation. */
const OLD = NOW - 30 * DAY;

const decide = (state: any, activity: any[] = [], now = NOW, activatedAt = OLD) =>
  decideUnreadEmail({ state, activity, now, activatedAt });

test("constants match the agreed rules", () => {
  assert.equal(UNREAD_EMAIL_IDLE_MS, 6 * HOUR);
  assert.equal(CHAT_SEEN_THROTTLE_MS, MIN);
  assert.equal(UNREAD_EMAIL_RETRY_MS, HOUR);
  assert.deepEqual(UNREAD_EMAIL_ROLES, ["customer", "expert"]);
});

// ── Rule 1: 6 hours without opening any chat ────────────────────────────────

test("in chat less than 6 hours ago: wait", () => {
  const state = { chatLastSeenAt: new Date(NOW - 6 * HOUR + MIN) };
  assert.deepEqual(decide(state, [new Date(NOW - HOUR)]), { action: "wait" });
});

test("exactly 6 hours out of chat with chat activity: check", () => {
  const state = { chatLastSeenAt: new Date(NOW - 6 * HOUR) };
  assert.deepEqual(decide(state, [new Date(NOW - HOUR)]), { action: "check" });
});

test("a message 5 minutes before the 6-hour mark still gets checked at the mark", () => {
  const seen = NOW - 6 * HOUR;
  const state = { chatLastSeenAt: new Date(seen) };
  assert.deepEqual(decide(state, [new Date(NOW - 5 * MIN)]), { action: "check" });
});

test("idle but in no chat that has ever had a message: wait, nothing to ask", () => {
  assert.deepEqual(decide({ chatLastSeenAt: new Date(NOW - 2 * DAY) }, []), { action: "wait" });
});

test("first check of an absence counts messages from before it began (a chat never opened)", () => {
  const state = { chatLastSeenAt: new Date(NOW - 7 * HOUR) };
  assert.deepEqual(decide(state, [new Date(NOW - 3 * DAY)]), { action: "check" });
});

test("never seen in chat: timed from the sweep's activation, not from 1970", () => {
  const activatedAt = NOW - 5 * HOUR;
  assert.deepEqual(decide({}, [new Date(NOW - DAY)], NOW, activatedAt), { action: "wait" });
  assert.deepEqual(decide({}, [new Date(NOW - DAY)], activatedAt + 6 * HOUR, activatedAt), { action: "check" });
});

test("a visit before activation is timed from activation, so deploying does not email at once", () => {
  const activatedAt = NOW - HOUR;
  const state = { chatLastSeenAt: new Date(NOW - 10 * DAY) };
  assert.deepEqual(decide(state, [new Date(NOW - DAY)], NOW, activatedAt), { action: "wait" });
});

test("after a check found nothing: wait until a newer message arrives", () => {
  const state = {
    chatLastSeenAt: new Date(NOW - 10 * HOUR),
    checkedAt: new Date(NOW - 3 * HOUR),
  };
  assert.deepEqual(decide(state, [new Date(NOW - 4 * HOUR)]), { action: "wait" });
  assert.deepEqual(decide(state, [new Date(NOW - 4 * HOUR), new Date(NOW - MIN)]), { action: "check" });
});

test("a check from an earlier absence does not count", () => {
  const state = {
    chatLastSeenAt: new Date(NOW - 7 * HOUR),
    checkedAt: new Date(NOW - 8 * HOUR),
  };
  assert.deepEqual(decide(state, [new Date(NOW - 9 * HOUR)]), { action: "check" });
});

test("an email from an earlier absence does not start a countdown", () => {
  const state = {
    chatLastSeenAt: new Date(NOW - 7 * HOUR),
    sentAt: new Date(NOW - 2 * DAY),
    countdownFrom: new Date(NOW - DAY),
  };
  assert.deepEqual(decide(state, [new Date(NOW - 9 * HOUR)]), { action: "check" });
});

// ── Rule 2: after an email, the next new message starts a fresh 6 hours ────

const emailed = (over: any = {}) => ({
  chatLastSeenAt: new Date(NOW - 2 * DAY),
  sentAt: new Date(NOW - 10 * HOUR),
  checkedAt: new Date(NOW - 10 * HOUR),
  ...over,
});

test("just emailed and no new message since: wait", () => {
  assert.deepEqual(decide(emailed(), [new Date(NOW - 11 * HOUR)]), { action: "wait" });
});

test("a new message after the email starts the countdown at that message", () => {
  const message = NOW - 2 * HOUR;
  assert.deepEqual(decide(emailed(), [new Date(message)]), { action: "startCountdown", fromMs: message });
});

test("the countdown starts at the earliest new message across chats", () => {
  const first = NOW - 3 * HOUR;
  const decision = decide(emailed(), [new Date(NOW - MIN), new Date(first), new Date(NOW - 11 * HOUR)]);
  assert.deepEqual(decision, { action: "startCountdown", fromMs: first });
});

test("a running countdown waits its full 6 hours, then checks", () => {
  const from = NOW - 6 * HOUR + MIN;
  assert.deepEqual(decide(emailed({ countdownFrom: new Date(from) }), [new Date(NOW - MIN)]), { action: "wait" });
  assert.deepEqual(
    decide(emailed({ countdownFrom: new Date(NOW - 6 * HOUR) }), [new Date(NOW - MIN)]),
    { action: "check" },
  );
});

test("later messages do not push a persisted countdown back", () => {
  const state = emailed({ countdownFrom: new Date(NOW - 6 * HOUR) });
  // Every room's lastMessageAt now reads as recent; the stored start still wins.
  assert.deepEqual(decide(state, [new Date(NOW - MIN)]), { action: "check" });
});

test("a new message already 6 hours old when first seen (sweep was down): check straight away", () => {
  assert.deepEqual(decide(emailed(), [new Date(NOW - 7 * HOUR)]), { action: "check" });
});

test("after a countdown check found nothing, the old countdown is spent", () => {
  const state = emailed({
    countdownFrom: new Date(NOW - 8 * HOUR),
    checkedAt: new Date(NOW - 2 * HOUR),
  });
  assert.deepEqual(decide(state, [new Date(NOW - 3 * HOUR)]), { action: "wait" });
  const fresh = NOW - HOUR;
  assert.deepEqual(decide(state, [new Date(fresh)]), { action: "startCountdown", fromMs: fresh });
});

test("a countdown left over from before the latest email is ignored", () => {
  const state = emailed({ countdownFrom: new Date(NOW - 12 * HOUR) });
  assert.deepEqual(decide(state, [new Date(NOW - 11 * HOUR)]), { action: "wait" });
});

test("opening a chat after an email resets to rule 1, timed from the visit", () => {
  const state = emailed({ chatLastSeenAt: new Date(NOW - HOUR), countdownFrom: new Date(NOW - 7 * HOUR) });
  assert.deepEqual(decide(state, [new Date(NOW - 30 * MIN)]), { action: "wait" });
  assert.deepEqual(decide(state, [new Date(NOW - 30 * MIN)], NOW + 5 * HOUR), { action: "check" });
});

// ── Robustness ──────────────────────────────────────────────────────────────

test("missing and malformed timestamps are ignored, never read as 1970", () => {
  const state = { chatLastSeenAt: null, sentAt: undefined, checkedAt: "", countdownFrom: "garbage" };
  assert.deepEqual(decide(state, [null, undefined, "", "nope"]), { action: "wait" });
  assert.deepEqual(decide(null, [new Date(NOW - HOUR)]), { action: "check" });
});

test("string timestamps are accepted", () => {
  const state = { chatLastSeenAt: new Date(NOW - 7 * HOUR).toISOString() };
  assert.deepEqual(decide(state, [new Date(NOW - HOUR).toISOString()]), { action: "check" });
});

// ── Which chats count, and the total ────────────────────────────────────────

test("countable rooms match the bell: DMs, seminars, communities, confirmed 1:1s", () => {
  const rooms = countableRoomIds(
    ["dm1", "", null, " dm2 "],
    [
      { rcChannelId: "sem", type: "seminar", status: "draft" },
      { rcChannelId: "com", type: "Community" },
      { rcChannelId: "appt", type: "individual", status: "active" },
      { rcChannelId: "pending-appt", type: "individual", status: "pending" },
      { rcChannelId: "", type: "seminar" },
      { type: "community" },
      null,
    ],
  );
  assert.deepEqual([...rooms].sort(), ["appt", "com", "dm1", "dm2", "sem"]);
});

test("total counts only countable rooms and ignores junk counts", () => {
  const countable = new Set(["a", "b", "c"]);
  assert.equal(totalUnread({ a: 2, b: "3", c: -1, other: 50, d: 4 }, countable), 5);
  assert.equal(totalUnread({ a: NaN, b: null }, countable), 0);
  assert.equal(totalUnread(null, countable), 0);
});

// ── Who gets it ─────────────────────────────────────────────────────────────

test("students and experts get it; admins, blocked users and opted-out users do not", () => {
  const base = { email: "x@example.com", status: "active" };
  assert.equal(isUnreadEmailRecipient({ ...base, role: "customer" }), true);
  assert.equal(isUnreadEmailRecipient({ ...base, role: "expert", status: "review" }), true);
  assert.equal(isUnreadEmailRecipient({ ...base, role: "admin" }), false);
  assert.equal(isUnreadEmailRecipient({ ...base, role: "customer", status: "blocked" }), false);
  assert.equal(
    isUnreadEmailRecipient({ ...base, role: "customer", notificationPreferences: { email: false } }),
    false,
  );
  assert.equal(
    isUnreadEmailRecipient({ ...base, role: "customer", notificationPreferences: { email: true, marketing: false } }),
    true,
  );
  assert.equal(isUnreadEmailRecipient({ role: "customer", status: "active" }), false);
  assert.equal(isUnreadEmailRecipient(null), false);
});

// ── A check that could not reach Rocket.Chat ────────────────────────────────

const awayAndOwed = { chatLastSeenAt: new Date(NOW - 10 * HOUR) };
const someMessage = [new Date(NOW - 9 * HOUR)];

test("a failed check waits an hour, then checks again with no new message", () => {
  const state = { ...awayAndOwed, failedAt: new Date(NOW - 59 * MIN) };
  assert.deepEqual(decide(state, someMessage), { action: "wait" });
  assert.deepEqual(decide({ ...awayAndOwed, failedAt: new Date(NOW - HOUR) }, someMessage), { action: "check" });
});

test("a failed countdown check is retried after an hour too", () => {
  const sent = new Date(NOW - 9 * HOUR);
  const state = {
    ...awayAndOwed,
    sentAt: sent,
    checkedAt: sent,
    countdownFrom: new Date(NOW - 7 * HOUR),
    failedAt: new Date(NOW - 30 * MIN),
  };
  assert.deepEqual(decide(state, [new Date(NOW - 7 * HOUR)]), { action: "wait" });
  assert.deepEqual(decide({ ...state, failedAt: new Date(NOW - 61 * MIN) }, [new Date(NOW - 7 * HOUR)]), {
    action: "check",
  });
});

test("a failure older than the latest check or email is spent", () => {
  const failedAt = new Date(NOW - 5 * HOUR);
  // A later successful check found nothing: wait for a newer message, as usual.
  assert.deepEqual(decide({ ...awayAndOwed, failedAt, checkedAt: new Date(NOW - 4 * HOUR) }, someMessage), {
    action: "wait",
  });
  assert.deepEqual(
    decide({ ...awayAndOwed, failedAt, checkedAt: new Date(NOW - 4 * HOUR) }, [new Date(NOW - 3 * HOUR)]),
    { action: "check" },
  );
});

test("a failure from an earlier absence is ignored", () => {
  const state = { chatLastSeenAt: new Date(NOW - 7 * HOUR), failedAt: new Date(NOW - 8 * HOUR) };
  assert.deepEqual(decide(state, someMessage), { action: "check" });
});

test("a failure never turns a wait or a countdown into a check", () => {
  assert.deepEqual(decide({ chatLastSeenAt: new Date(NOW - HOUR), failedAt: new Date(NOW - 2 * HOUR) }, someMessage), {
    action: "wait",
  });
  const sent = new Date(NOW - 3 * HOUR);
  const fresh = new Date(NOW - 2 * HOUR);
  assert.deepEqual(
    decide({ ...awayAndOwed, sentAt: sent, checkedAt: sent, failedAt: new Date(NOW - 10 * HOUR) }, [fresh]),
    { action: "startCountdown", fromMs: fresh.getTime() },
  );
});
