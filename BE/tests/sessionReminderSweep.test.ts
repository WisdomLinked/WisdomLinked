import test from "node:test";
import assert from "node:assert/strict";

// The sweep destructures its dependencies at require time, so these are installed
// before it loads; per-test data is swapped through `withData`.
const notifications = require("../services/notifications");
const GroupChat = require("../models/GroupChat");
const Event = require("../models/Event");
const User = require("../models/User");
const AppState = require("../models/AppState");

const sent: any[] = [];
// The sweep destructures this at require time, so the dispatcher installed here is
// the one it keeps; per-test behaviour is swapped through `sendImpl`.
const recordSend = async (args: any) => { sent.push(args); };
let sendImpl: (args: any) => Promise<void> = recordSend;
notifications.sendSessionReminderEmail = (args: any) => sendImpl(args);

const { sweepSessionReminders, wantsReminder } = require("../services/sessionReminderSweep");

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 8, 13, 12, 0, 0);

const user = (id: string, over: any = {}) => ({
  _id: id,
  email: `${id}@example.com`,
  username: id,
  timeZone: "UTC",
  ...over,
});

/**
 * Install fake collections. `claimed` records every atomic claim so tests can
 * assert that a reminder was ticked off exactly once.
 */
const withData = ({ groups = [], events = [], users = [], activatedAt = null }: any) => {
  const original = {
    aFind: AppState.findOne,
    aUpdate: AppState.updateOne,
    gFind: GroupChat.find,
    gFOAU: GroupChat.findOneAndUpdate,
    eFind: Event.find,
    eFOAU: Event.findOneAndUpdate,
    uById: User.findById,
    uFind: User.find,
  };

  // The sweep reads its activation stamp on every tick. Tests that do not care
  // supply none, which leaves the notBefore rule inert.
  let stamp: any = activatedAt;
  AppState.findOne = async () => (stamp ? { reminderSweepActivatedAt: stamp } : null);
  AppState.updateOne = async (filter: any, update: any) => {
    const v = update?.$set?.reminderSweepActivatedAt;
    if (v && !stamp) stamp = v;
    return { acknowledged: true };
  };
  const byId = new Map(users.map((u: any) => [String(u._id), u]));
  const claimed: string[] = [];

  const matchWindow = (docs: any[], filter: any) =>
    docs.filter((d) => {
      const ms = new Date(d.start).getTime();
      const okType = !filter.type || filter.type.$in.includes(d.type);
      const okStatus = !filter.status || d.status === filter.status;
      return okType && okStatus &&
        ms > filter.start.$gt.getTime() && ms <= filter.start.$lte.getTime();
    });

  const claimer = (docs: any[]) => async (filter: any, update: any) => {
    const doc = docs.find((d) => String(d._id) === String(filter._id));
    const kind = update.$addToSet.remindersSent;
    if (!doc) return null;
    if ((doc.remindersSent || []).includes(kind)) return null;   // already claimed
    doc.remindersSent = [...(doc.remindersSent || []), kind];
    claimed.push(`${doc._id}:${kind}`);
    return doc;
  };

  GroupChat.find = async (filter: any) => matchWindow(groups, filter);
  Event.find = async (filter: any) => matchWindow(events, filter);
  GroupChat.findOneAndUpdate = claimer(groups);
  Event.findOneAndUpdate = claimer(events);
  User.findById = async (id: any) => byId.get(String(id)) || null;
  User.find = async (filter: any) =>
    (filter._id.$in || []).map((id: any) => byId.get(String(id))).filter(Boolean);

  return {
    claimed,
    restore: () => {
      GroupChat.find = original.gFind;
      GroupChat.findOneAndUpdate = original.gFOAU;
      Event.find = original.eFind;
      Event.findOneAndUpdate = original.eFOAU;
      User.findById = original.uById;
      User.find = original.uFind;
      AppState.findOne = original.aFind;
      AppState.updateOne = original.aUpdate;
    },
  };
};

const seminar = (over: any = {}) => ({
  _id: "sem1",
  name: "Intro to Quantum Computing",
  type: "seminar",
  status: "active",
  start: new Date(NOW + DAY),
  createdAt: new Date(NOW - 30 * DAY),
  duration: 60,
  admin: "expert1",
  participants: ["student1", "student2"],
  remindersSent: [],
  ...over,
});

const oneToOne = (over: any = {}) => ({
  _id: "chat1",
  name: "1:1 with Dr Smith",
  type: "individual",
  status: "active",
  start: new Date(NOW + DAY),
  createdAt: new Date(NOW - 10 * DAY),
  duration: 30,
  admin: "expert1",
  participants: ["student1", "expert1"],
  remindersSent: [],
  ...over,
});

const legacyEvent = (over: any = {}) => ({
  _id: "evt1",
  title: "Legacy session",
  status: "accepted",
  start: new Date(NOW + DAY),
  createdAt: new Date(NOW - 10 * DAY),
  duration: 30,
  expert: "expert1",
  customer: "student1",
  remindersSent: [],
  ...over,
});

const reset = () => { sent.length = 0; };
const recipients = () => sent.map((s) => s.targetEmail).sort();

// --- who gets reminded ------------------------------------------------------

test("a seminar reminds the host as well as every participant", async () => {
  reset();
  const d = withData({
    groups: [seminar()],
    users: [user("expert1"), user("student1"), user("student2")],
  });
  try {
    // exactly at the 24h mark
    const count = await sweepSessionReminders(NOW);
    assert.equal(count, 3);
    assert.deepEqual(recipients(), [
      "expert1@example.com", "student1@example.com", "student2@example.com",
    ]);
    // the host is addressed as an expert, participants as students
    assert.equal(sent.find((s) => s.targetEmail === "expert1@example.com").role, "expert");
    assert.equal(sent.find((s) => s.targetEmail === "student1@example.com").role, "customer");
    assert.deepEqual(d.claimed, ["sem1:24h"]);
  } finally { d.restore(); }
});

test("a 1:1 in GroupChat reminds both sides exactly once each", async () => {
  reset();
  // the expert is both admin and a participant — they must not be mailed twice
  const d = withData({
    groups: [oneToOne()],
    users: [user("expert1"), user("student1")],
  });
  try {
    const count = await sweepSessionReminders(NOW);
    assert.equal(count, 2);
    assert.deepEqual(recipients(), ["expert1@example.com", "student1@example.com"]);
  } finally { d.restore(); }
});

test("a legacy Event reminds both sides", async () => {
  reset();
  const d = withData({
    events: [legacyEvent()],
    users: [user("expert1"), user("student1")],
  });
  try {
    assert.equal(await sweepSessionReminders(NOW), 2);
    assert.deepEqual(recipients(), ["expert1@example.com", "student1@example.com"]);
  } finally { d.restore(); }
});

// --- eligibility is judged from confirmation, not proposal ------------------

test("a 1:1 confirmed inside the 24h mark gets only the 15-minute reminder", async () => {
  reset();
  const d = withData({
    groups: [oneToOne({
      start: new Date(NOW + 20 * HOUR),
      createdAt: new Date(NOW - 10 * DAY),
      confirmedAt: new Date(NOW),
    })],
    users: [user("expert1"), user("student1")],
  });
  try {
    assert.equal(await sweepSessionReminders(NOW), 0);
    const at15m = NOW + 20 * HOUR - 15 * MIN;
    assert.equal(await sweepSessionReminders(at15m), 2);
    assert.deepEqual(sent.map((x: any) => x.kind), ["15m", "15m"]);
  } finally { d.restore(); }
});

test("a 1:1 confirmed before the 24h mark still gets both", async () => {
  reset();
  const d = withData({
    groups: [oneToOne({
      start: new Date(NOW + 25 * HOUR),
      createdAt: new Date(NOW - 10 * DAY),
      confirmedAt: new Date(NOW),
    })],
    users: [user("expert1"), user("student1")],
  });
  try {
    const at24h = NOW + 25 * HOUR - 24 * HOUR;
    assert.equal(await sweepSessionReminders(at24h), 2);
    assert.deepEqual(sent.map((x: any) => x.kind), ["24h", "24h"]);
  } finally { d.restore(); }
});

test("a legacy Event is judged from confirmedAt too", async () => {
  reset();
  const d = withData({
    events: [legacyEvent({
      start: new Date(NOW + 20 * HOUR),
      createdAt: new Date(NOW - 10 * DAY),
      confirmedAt: new Date(NOW),
    })],
    users: [user("expert1"), user("student1")],
  });
  try {
    assert.equal(await sweepSessionReminders(NOW), 0);
  } finally { d.restore(); }
});

test("a row with no confirmedAt falls back to createdAt", async () => {
  reset();
  // Sessions confirmed before the field existed must keep working.
  const d = withData({
    groups: [oneToOne({
      start: new Date(NOW + 25 * HOUR),
      createdAt: new Date(NOW - 10 * DAY),
    })],
    users: [user("expert1"), user("student1")],
  });
  try {
    const at24h = NOW + 25 * HOUR - 24 * HOUR;
    assert.equal(await sweepSessionReminders(at24h), 2);
  } finally { d.restore(); }
});

test("a seminar is unaffected — it has no confirmation step", async () => {
  reset();
  const d = withData({
    groups: [seminar({ start: new Date(NOW + 25 * HOUR), createdAt: new Date(NOW - 30 * DAY) })],
    users: [user("expert1"), user("student1"), user("student2")],
  });
  try {
    const at24h = NOW + 25 * HOUR - 24 * HOUR;
    assert.equal(await sweepSessionReminders(at24h), 3);
  } finally { d.restore(); }
});

// --- the deploy that introduces the sweep -----------------------------------

test("the first sweep in an environment does not fire a backlog", async () => {
  reset();
  // A database of live bookings, none with reminder history because the field is
  // new. Their 24h marks are already in the past; without the activation stamp
  // this tick would email every one of them at once.
  const d = withData({
    groups: [
      seminar({ _id: "old1", start: new Date(NOW + 2 * HOUR), createdAt: new Date(NOW - 30 * DAY) }),
      seminar({ _id: "old2", start: new Date(NOW + 20 * HOUR), createdAt: new Date(NOW - 30 * DAY) }),
    ],
    users: [user("expert1"), user("student1"), user("student2")],
  });
  try {
    assert.equal(await sweepSessionReminders(NOW), 0);
    assert.deepEqual(recipients(), []);
  } finally { d.restore(); }
});

test("activation suppresses only the marks it predates, not later ones", async () => {
  reset();
  // Same session, but now at its 15-minute mark — which falls after activation,
  // so it is genuinely owed and must still be sent.
  const d = withData({
    groups: [seminar({ start: new Date(NOW + 20 * HOUR), createdAt: new Date(NOW - 30 * DAY) })],
    users: [user("expert1"), user("student1"), user("student2")],
    activatedAt: new Date(NOW),
  });
  try {
    assert.equal(await sweepSessionReminders(NOW), 0);              // 24h mark: predates activation
    const at15m = NOW + 20 * HOUR - 15 * MIN;
    assert.equal(await sweepSessionReminders(at15m), 3);            // 15m mark: after it
  } finally { d.restore(); }
});

test("the activation stamp is written once and reused, so restarts cannot move it", async () => {
  reset();
  const d = withData({
    groups: [seminar({ start: new Date(NOW + 40 * HOUR), createdAt: new Date(NOW - 30 * DAY) })],
    users: [user("expert1"), user("student1"), user("student2")],
  });
  try {
    await sweepSessionReminders(NOW);                                // stamps activation
    const stamped = await AppState.findOne();
    const first = new Date(stamped.reminderSweepActivatedAt).getTime();
    await sweepSessionReminders(NOW + 10 * HOUR);                    // a later "restart"
    const again = await AppState.findOne();
    assert.equal(new Date(again.reminderSweepActivatedAt).getTime(), first);
    // and a mark falling due after activation still fires
    reset();
    assert.equal(await sweepSessionReminders(NOW + 40 * HOUR - 24 * HOUR), 3);
  } finally { d.restore(); }
});

test("a community is never reminded — it has no start time", async () => {
  reset();
  const d = withData({
    groups: [seminar({ _id: "com1", type: "community" })],
    users: [user("expert1"), user("student1"), user("student2")],
  });
  try {
    assert.equal(await sweepSessionReminders(NOW), 0);
  } finally { d.restore(); }
});

// --- timing -----------------------------------------------------------------

test("both marks fire across a session's life, and neither repeats", async () => {
  reset();
  const s = seminar({ start: new Date(NOW + 7 * DAY) });
  const d = withData({ groups: [s], users: [user("expert1"), user("student1"), user("student2")] });
  try {
    // a week out: nothing
    assert.equal(await sweepSessionReminders(NOW), 0);

    // 24h mark
    const at24h = NOW + 7 * DAY - 24 * HOUR;
    assert.equal(await sweepSessionReminders(at24h), 3);
    reset();
    // the next tick three minutes later must not send again
    assert.equal(await sweepSessionReminders(at24h + 3 * MIN), 0);

    // 15-minute mark
    const at15m = NOW + 7 * DAY - 15 * MIN;
    assert.equal(await sweepSessionReminders(at15m), 3);
    reset();
    assert.equal(await sweepSessionReminders(at15m + 3 * MIN), 0);

    assert.deepEqual(s.remindersSent, ["24h", "15m"]);
  } finally { d.restore(); }
});

test("a session booked under 15 minutes before start is never reminded", async () => {
  reset();
  const d = withData({
    groups: [seminar({ start: new Date(NOW + 10 * MIN), createdAt: new Date(NOW) })],
    users: [user("expert1"), user("student1"), user("student2")],
  });
  try {
    assert.equal(await sweepSessionReminders(NOW), 0);
    assert.equal(await sweepSessionReminders(NOW + 5 * MIN), 0);
  } finally { d.restore(); }
});

test("a cancelled session stops matching, so nothing is sent", async () => {
  reset();
  const d = withData({
    groups: [seminar({ status: "cancelled" })],
    users: [user("expert1"), user("student1"), user("student2")],
  });
  try {
    assert.equal(await sweepSessionReminders(NOW), 0);
  } finally { d.restore(); }
});

test("a rescheduled session is read at its current start, not its old one", async () => {
  reset();
  const s = seminar({ start: new Date(NOW + 7 * DAY) });
  const d = withData({ groups: [s], users: [user("expert1"), user("student1"), user("student2")] });
  try {
    // moved forward to tomorrow — the sweep reads the document, not a queued job
    s.start = new Date(NOW + DAY);
    assert.equal(await sweepSessionReminders(NOW), 3);
  } finally { d.restore(); }
});

// --- notification preferences ----------------------------------------------

test("notification preferences are honoured, per session type", () => {
  assert.equal(wantsReminder(user("a"), "seminar"), true);            // no prefs at all
  assert.equal(wantsReminder(user("a", { notificationPreferences: {} }), "seminar"), true);
  assert.equal(
    wantsReminder(user("a", { notificationPreferences: { seminarReminders: false } }), "seminar"),
    false,
  );
  // a seminar opt-out must not silence 1:1 sessions
  assert.equal(
    wantsReminder(user("a", { notificationPreferences: { seminarReminders: false } }), "individual"),
    true,
  );
  // the master email switch overrides both
  assert.equal(
    wantsReminder(user("a", { notificationPreferences: { email: false } }), "individual"),
    false,
  );
});

test("an opted-out participant is skipped but the others still get theirs", async () => {
  reset();
  const d = withData({
    groups: [seminar()],
    users: [
      user("expert1"),
      user("student1", { notificationPreferences: { seminarReminders: false } }),
      user("student2"),
    ],
  });
  try {
    assert.equal(await sweepSessionReminders(NOW), 2);
    assert.deepEqual(recipients(), ["expert1@example.com", "student2@example.com"]);
  } finally { d.restore(); }
});

// --- resilience -------------------------------------------------------------

test("one failing recipient does not stop the rest of the sweep", async () => {
  reset();
  sendImpl = async (args: any) => {
    if (args.targetEmail === "student1@example.com") throw new Error("bad address");
    sent.push(args);
  };
  const d = withData({
    groups: [seminar()],
    users: [user("expert1"), user("student1"), user("student2")],
  });
  try {
    assert.equal(await sweepSessionReminders(NOW), 2);
    assert.deepEqual(recipients(), ["expert1@example.com", "student2@example.com"]);
  } finally {
    d.restore();
    sendImpl = recordSend;
  }
});

test("a participant with no user record is skipped quietly", async () => {
  reset();
  const d = withData({
    groups: [seminar()],
    users: [user("expert1"), user("student1")],   // student2 missing
  });
  try {
    assert.equal(await sweepSessionReminders(NOW), 2);
  } finally { d.restore(); }
});

test("a database failure is contained — the interval keeps running", async () => {
  reset();
  const original = GroupChat.find;
  GroupChat.find = async () => { throw new Error("mongo is down"); };
  try {
    assert.equal(await sweepSessionReminders(NOW), 0);
  } finally { GroupChat.find = original; }
});

test("each recipient's reminder renders in their own timezone", async () => {
  reset();
  const d = withData({
    groups: [seminar({ participants: ["student1"] })],
    users: [
      user("expert1", { timeZone: "Asia/Shanghai" }),
      user("student1", { timeZone: "America/New_York" }),
    ],
  });
  try {
    await sweepSessionReminders(NOW);
    assert.equal(sent.find((s) => s.targetEmail === "expert1@example.com").timeZone, "Asia/Shanghai");
    assert.equal(sent.find((s) => s.targetEmail === "student1@example.com").timeZone, "America/New_York");
  } finally { d.restore(); }
});
