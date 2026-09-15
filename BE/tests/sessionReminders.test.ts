import test from "node:test";
import assert from "node:assert/strict";

import {
  dueReminders,
  isLateBooking,
  reminderQueryWindow,
  REMINDER_LEAD_MS,
  REMINDER_STALE_AFTER_MS,
  LATE_BOOKING_CUTOFF_MS,
  MAX_REMINDER_LEAD_MS,
} from "../utils/sessionReminders";

const NOW = Date.UTC(2026, 8, 13, 12, 0, 0);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** A session starting `lead` from NOW, booked `bookedAgo` before that start. */
const session = (lead: number, bookedAgo = 30 * DAY) => ({
  start: new Date(NOW + lead),
  createdAt: new Date(NOW + lead - bookedAgo),
});

// --- the three scenarios we agreed on -------------------------------------

test("booked more than 24h ahead: both reminders fire, each at its own mark", () => {
  const s = session(7 * DAY);

  // a week out, nothing is due yet
  assert.deepEqual(dueReminders({ ...s, now: NOW }), []);

  // the 24h mark passes
  const at24h = NOW + 7 * DAY - 24 * HOUR;
  assert.deepEqual(dueReminders({ ...s, now: at24h }), ["24h"]);

  // ...and having sent it, it does not come round again
  assert.deepEqual(dueReminders({ ...s, alreadySent: ["24h"], now: at24h + 3 * MIN }), []);

  // the 15-minute mark passes
  const at15m = NOW + 7 * DAY - 15 * MIN;
  assert.deepEqual(dueReminders({ ...s, alreadySent: ["24h"], now: at15m }), ["15m"]);

  // both sent: nothing left
  assert.deepEqual(dueReminders({ ...s, alreadySent: ["24h", "15m"], now: at15m }), []);
});

test("booked between 24h and 15min ahead: only the 15-minute reminder", () => {
  // booked 3 hours before start — the 24h mark is already in the past at booking
  const start = new Date(NOW + 3 * HOUR);
  const createdAt = new Date(NOW);

  // the 24h mark passed before this session existed, so it must never fire
  assert.deepEqual(dueReminders({ start, createdAt, now: NOW }), []);

  const at15m = NOW + 3 * HOUR - 15 * MIN;
  assert.deepEqual(dueReminders({ start, createdAt, now: at15m }), ["15m"]);
});

test("booked inside the 24h mark but more than 18h out: still only the 15-minute one", () => {
  const start = new Date(NOW + 20 * HOUR);
  const createdAt = new Date(NOW);

  assert.deepEqual(dueReminders({ start, createdAt, now: NOW }), []);
  assert.deepEqual(dueReminders({ start, createdAt, now: NOW + 1 * HOUR }), []);

  const at15m = NOW + 20 * HOUR - 15 * MIN;
  assert.deepEqual(dueReminders({ start, createdAt, now: at15m }), ["15m"]);
});

test("booked exactly on the 24h mark still gets both", () => {
  const start = new Date(NOW + 24 * HOUR);
  const createdAt = new Date(NOW);

  assert.deepEqual(dueReminders({ start, createdAt, now: NOW }), ["24h"]);
  const at15m = NOW + 24 * HOUR - 15 * MIN;
  assert.deepEqual(dueReminders({ start, createdAt, alreadySent: ["24h"], now: at15m }), ["15m"]);
});

test("an outage across the 24h mark still catches up for an eligible session", () => {
  // Booked a week out, so it is eligible; the server misses the mark by 5h.
  const start = new Date(NOW + 24 * HOUR);
  const createdAt = new Date(NOW - 7 * 24 * HOUR);

  const fiveHoursLate = NOW + 5 * HOUR;
  assert.deepEqual(dueReminders({ start, createdAt, now: fiveHoursLate }), ["24h"]);
});

test("a mark that passed before the sweep existed here is not owed", () => {
  // The deploy that introduces the sweep meets a database full of sessions with
  // no reminder history. Without this, the first tick would email everyone
  // starting within 24h at once.
  const start = new Date(NOW + 10 * HOUR);
  const createdAt = new Date(NOW - 30 * DAY);
  const activatedAt = NOW;                       // sweep goes live now

  // the 24h mark passed 14h before activation: never ours to send
  assert.deepEqual(dueReminders({ start, createdAt, now: NOW, notBefore: activatedAt }), []);

  // ...but the 15-minute mark is still ahead, so it is genuinely owed
  const at15m = NOW + 10 * HOUR - 15 * MIN;
  assert.deepEqual(
    dueReminders({ start, createdAt, now: at15m, notBefore: activatedAt }),
    ["15m"],
  );
});

test("notBefore does not suppress marks that fall due after activation", () => {
  const start = new Date(NOW + 40 * HOUR);
  const createdAt = new Date(NOW - 30 * DAY);
  const at24h = NOW + 40 * HOUR - 24 * HOUR;     // 16h after activation
  assert.deepEqual(dueReminders({ start, createdAt, now: at24h, notBefore: NOW }), ["24h"]);
});

test("notBefore is what suppresses it — the same session fires without it", () => {
  // 20h out, so the 24h mark passed 4h ago: inside the 6h staleness window, which
  // means it WOULD be sent on catch-up. Only notBefore stops it. This is the case
  // the deploy burst is actually made of.
  const start = new Date(NOW + 20 * HOUR);
  const createdAt = new Date(NOW - 30 * DAY);

  assert.deepEqual(dueReminders({ start, createdAt, now: NOW }), ["24h"]);
  assert.deepEqual(dueReminders({ start, createdAt, now: NOW, notBefore: null }), ["24h"]);
  assert.deepEqual(dueReminders({ start, createdAt, now: NOW, notBefore: NOW }), []);
});

test("booked under 15 minutes before start: no reminder at all", () => {
  const start = new Date(NOW + 10 * MIN);
  const createdAt = new Date(NOW);

  assert.equal(isLateBooking(start, createdAt), true);
  assert.deepEqual(dueReminders({ start, createdAt, now: NOW }), []);
  assert.deepEqual(dueReminders({ start, createdAt, now: NOW + 5 * MIN }), []);
});

// --- the boundary the late-booking rule turns on ---------------------------

test("the late-booking cutoff is exactly 15 minutes, and the boundary is inclusive-safe", () => {
  assert.equal(LATE_BOOKING_CUTOFF_MS, 15 * MIN);

  const start = new Date(NOW + DAY);
  // booked exactly 15 minutes before start: not late, still gets the 15m reminder
  assert.equal(isLateBooking(start, new Date(NOW + DAY - 15 * MIN)), false);
  // booked one millisecond later: late
  assert.equal(isLateBooking(start, new Date(NOW + DAY - 15 * MIN + 1)), true);
});

test("a missing createdAt does not count as a late booking", () => {
  // Absence of evidence is not evidence of lateness — staying silent is the worse
  // failure, so an undated session is reminded normally.
  const start = new Date(NOW + DAY);
  assert.equal(isLateBooking(start, undefined), false);
  assert.equal(isLateBooking(start, null), false);
  assert.equal(isLateBooking(start, "not a date"), false);
  assert.deepEqual(
    dueReminders({ start, createdAt: undefined, now: NOW + DAY - 24 * HOUR }),
    ["24h"],
  );
});

// --- catching up, and refusing to ------------------------------------------

test("a mark passed during an outage still fires for 24h, but not for 15m", () => {
  const s = session(2 * DAY);
  const at24h = NOW + 2 * DAY - 24 * HOUR;

  // back up an hour late: "your session is tomorrow" is still true, so send it
  assert.deepEqual(dueReminders({ ...s, now: at24h + HOUR }), ["24h"]);

  // ...but not a day and a half late
  assert.deepEqual(dueReminders({ ...s, now: at24h + 7 * HOUR }), []);

  const at15m = NOW + 2 * DAY - 15 * MIN;
  // two minutes late is fine
  assert.deepEqual(dueReminders({ ...s, alreadySent: ["24h"], now: at15m + 2 * MIN }), ["15m"]);
  // twelve minutes late is not — the session is nearly starting
  assert.deepEqual(dueReminders({ ...s, alreadySent: ["24h"], now: at15m + 12 * MIN }), []);
});

test("the two staleness windows differ, and 24h is the generous one", () => {
  assert.ok(REMINDER_STALE_AFTER_MS["24h"] > REMINDER_STALE_AFTER_MS["15m"]);
  assert.equal(REMINDER_STALE_AFTER_MS["15m"], 5 * MIN);
});

test("a session already under way gets nothing, however it got there", () => {
  const s = session(DAY);
  assert.deepEqual(dueReminders({ ...s, now: NOW + DAY }), []);        // exactly at start
  assert.deepEqual(dueReminders({ ...s, now: NOW + DAY + MIN }), []);  // just after
  assert.deepEqual(dueReminders({ ...s, now: NOW + DAY + 3 * DAY }), []);
});

// --- idempotency and junk ---------------------------------------------------

test("an already-sent kind is never repeated, whatever else is pending", () => {
  const s = session(2 * DAY);
  const at15m = NOW + 2 * DAY - 15 * MIN;

  // both marks passed but 24h already went out — only the 15m is left
  assert.deepEqual(dueReminders({ ...s, alreadySent: ["24h"], now: at15m }), ["15m"]);
  // unknown entries in the list are ignored rather than throwing
  assert.deepEqual(dueReminders({ ...s, alreadySent: ["1h", "24h"], now: at15m }), ["15m"]);
  assert.deepEqual(dueReminders({ ...s, alreadySent: null, now: at15m + 20 * MIN }), []);
});

test("an unusable start time yields nothing rather than throwing", () => {
  for (const start of [null, undefined, "", "tomorrow", NaN, {}]) {
    assert.deepEqual(dueReminders({ start, now: NOW }), [], `start=${String(start)}`);
  }
});

test("the two reminders can never both be due on the same tick", () => {
  // This falls out of the staleness windows rather than being enforced anywhere:
  // 24h is only due while the session is 18-24h away, 15m only while it is 10-15min
  // away. The ranges cannot overlap, so a tick never sends two mails to one person.
  // Worth pinning: it is why no ordering or batching logic is needed below.
  const createdAt = new Date(NOW - 60 * DAY);
  for (let minutesAhead = 1; minutesAhead <= 26 * 60; minutesAhead += 1) {
    const start = new Date(NOW + minutesAhead * MIN);
    const due = dueReminders({ start, createdAt, now: NOW });
    assert.ok(due.length <= 1, `${minutesAhead}min ahead produced ${due.join("+")}`);
  }
});

test("a session whose 24h mark passed long ago still gets its 15-minute reminder", () => {
  // The 24h one is stale and correctly skipped; that must not suppress the later one.
  const start = new Date(NOW + 15 * MIN);
  const createdAt = new Date(NOW - 10 * DAY);
  assert.deepEqual(dueReminders({ start, createdAt, now: NOW }), ["15m"]);
});

// --- the query window -------------------------------------------------------

test("the query window spans now to the furthest mark", () => {
  const { from, to } = reminderQueryWindow(NOW);
  assert.equal(from.getTime(), NOW);
  assert.equal(to.getTime(), NOW + DAY);
  assert.equal(MAX_REMINDER_LEAD_MS, REMINDER_LEAD_MS["24h"]);
});
