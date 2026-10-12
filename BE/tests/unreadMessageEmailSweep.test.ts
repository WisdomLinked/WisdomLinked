import test from "node:test";
import assert from "node:assert/strict";

const notifications = require("../services/notifications");
const AppState = require("../models/AppState");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const GroupChat = require("../models/GroupChat");

const {
  sweepUnreadMessageEmails,
  recordChatSeen,
  MAX_CONSECUTIVE_RC_FAILURES,
} = require("../services/unreadMessageEmailSweep");

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 9, 12, 12, 0, 0);

const ms = (v: any) => (v == null ? null : new Date(v).getTime());
const sameInstant = (a: any, b: any) => ms(a) === ms(b);
const copy = (doc: any) => ({ ...doc });

const withData = ({ users = [], conversations = [], groups = [], activatedAt = null }: any) => {
  const original = {
    aFind: AppState.findOne,
    aUpdate: AppState.updateOne,
    uFind: User.find,
    uUpdate: User.updateOne,
    uFOAU: User.findOneAndUpdate,
    cFind: Conversation.find,
    gFind: GroupChat.find,
  };

  let stamp: any = activatedAt;
  AppState.findOne = async () => (stamp ? { unreadEmailSweepActivatedAt: stamp } : null);
  AppState.updateOne = async (_filter: any, update: any) => {
    const v = update?.$set?.unreadEmailSweepActivatedAt;
    if (v && !stamp) stamp = v;
    return { acknowledged: true };
  };

  const byId = new Map(users.map((u: any) => [String(u._id), u]));
  const queries: any[] = [];
  const chain = (rows: any[]) => ({ select: () => ({ lean: async () => rows.map(copy) }) });

  User.find = (filter: any) => {
    queries.push(filter);
    return chain(users);
  };
  User.updateOne = async (filter: any, update: any) => {
    const doc: any = byId.get(String(filter._id));
    if (doc) Object.assign(doc, update.$set);
    return { acknowledged: true };
  };
  User.findOneAndUpdate = async (filter: any, update: any) => {
    const doc: any = byId.get(String(filter._id));
    if (!doc) return null;
    if ("chatLastSeenAt" in filter && !sameInstant(doc.chatLastSeenAt, filter.chatLastSeenAt)) return null;
    if ("unreadEmailSentAt" in filter && !sameInstant(doc.unreadEmailSentAt, filter.unreadEmailSentAt)) return null;
    Object.assign(doc, update.$set);
    return { _id: doc._id };
  };
  Conversation.find = (filter: any) => {
    const ids = (filter._id.$in || []).map(String);
    return chain(conversations.filter((c: any) => ids.includes(String(c._id))));
  };
  GroupChat.find = (filter: any) => {
    if (filter.rcChannelId) {
      const rids = filter.rcChannelId.$in;
      return chain(groups.filter((g: any) => rids.includes(g.rcChannelId)));
    }
    const [byIds, communities] = filter.$or;
    const ids = (byIds._id.$in || []).map(String);
    const me = String(communities.participants);
    return chain(
      groups.filter(
        (g: any) =>
          ids.includes(String(g._id)) ||
          (g.type === "community" && (g.participants || []).map(String).includes(me)),
      ),
    );
  };

  return {
    queries,
    stamp: () => stamp,
    user: (id: string) => byId.get(id) as any,
    restore() {
      AppState.findOne = original.aFind;
      AppState.updateOne = original.aUpdate;
      User.find = original.uFind;
      User.updateOne = original.uUpdate;
      User.findOneAndUpdate = original.uFOAU;
      Conversation.find = original.cFind;
      GroupChat.find = original.gFind;
    },
  };
};

/** Fake Rocket.Chat and email. `unread` maps an email to that user's unread-by-room. */
const fakes = (unread: Record<string, any> = {}) => {
  const asked: string[] = [];
  const mails: any[] = [];
  return {
    asked,
    mails,
    deps: {
      countUnread: async (reader: any) => {
        asked.push(reader.email);
        if (!(reader.email in unread)) return {};
        const value = unread[reader.email];
        return typeof value === "function" ? value() : value;
      },
      sendEmail: async (args: any) => {
        mails.push(args);
      },
    },
  };
};

const student = (over: any = {}) => ({
  _id: "s1",
  email: "s1@example.com",
  username: "Sam",
  role: "customer",
  status: "active",
  notificationPreferences: { email: true },
  directConversations: ["c1"],
  groupChats: ["g1"],
  generalChats: [],
  chatLastSeenAt: new Date(T0 - 7 * HOUR),
  ...over,
});

const ROOMS = {
  conversations: [{ _id: "c1", rcChannelId: "dm-rid", lastMessageAt: new Date(T0 - 2 * HOUR) }],
  groups: [
    { _id: "g1", rcChannelId: "sem-rid", type: "seminar", status: "active", lastMessageAt: new Date(T0 - 3 * HOUR) },
  ],
};
const ACTIVATED = new Date(T0 - 30 * DAY);

test("idle 6 hours with unread: one email with the bell's total, ignoring rooms the bell ignores", async () => {
  const data = withData({ users: [student()], ...ROOMS, activatedAt: ACTIVATED });
  const f = fakes({ "s1@example.com": { "dm-rid": 2, "sem-rid": 1, "left-room": 40 } });
  try {
    const sent = await sweepUnreadMessageEmails(T0, f.deps);
    assert.equal(sent, 1);
    assert.deepEqual(f.mails, [
      { targetEmail: "s1@example.com", userName: "Sam", unreadCount: 3, role: "customer" },
    ]);
    assert.equal(ms(data.user("s1").unreadEmailSentAt), T0);
    assert.equal(ms(data.user("s1").unreadEmailCheckedAt), T0);
  } finally {
    data.restore();
  }
});

test("the query only loads students and experts who are idle, not blocked, not opted out", async () => {
  const data = withData({ users: [], activatedAt: ACTIVATED });
  try {
    await sweepUnreadMessageEmails(T0, fakes().deps);
    const q = data.queries[0];
    assert.deepEqual(q.role, { $in: ["customer", "expert"] });
    assert.deepEqual(q.status, { $ne: "blocked" });
    assert.deepEqual(q["notificationPreferences.email"], { $ne: false });
    assert.deepEqual(q.$or, [
      { chatLastSeenAt: null },
      { chatLastSeenAt: { $lte: new Date(T0 - 6 * HOUR) } },
    ]);
  } finally {
    data.restore();
  }
});

test("first deploy: activation is stamped and nobody is emailed for 6 hours", async () => {
  const data = withData({ users: [student({ chatLastSeenAt: null })], ...ROOMS });
  const f = fakes({ "s1@example.com": { "dm-rid": 5 } });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 0);
    assert.equal(ms(data.stamp()), T0);
    assert.equal(await sweepUnreadMessageEmails(T0 + 6 * HOUR - MIN, f.deps), 0);
    assert.deepEqual(f.asked, []);
    assert.equal(await sweepUnreadMessageEmails(T0 + 6 * HOUR, f.deps), 1);
  } finally {
    data.restore();
  }
});

test("nothing unread: no email, and Rocket.Chat is not asked again until a new message", async () => {
  const data = withData({ users: [student()], ...ROOMS, activatedAt: ACTIVATED });
  const f = fakes({ "s1@example.com": {} });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 0);
    assert.equal(ms(data.user("s1").unreadEmailCheckedAt), T0);
    await sweepUnreadMessageEmails(T0 + 15 * MIN, f.deps);
    await sweepUnreadMessageEmails(T0 + 30 * MIN, f.deps);
    assert.equal(f.asked.length, 1);

    ROOMS.conversations[0].lastMessageAt = new Date(T0 + 40 * MIN);
    (f.deps as any).countUnread = async (reader: any) => {
      f.asked.push(reader.email);
      return { "dm-rid": 1 };
    };
    assert.equal(await sweepUnreadMessageEmails(T0 + 45 * MIN, f.deps), 1);
    assert.equal(f.mails[0].unreadCount, 1);
  } finally {
    ROOMS.conversations[0].lastMessageAt = new Date(T0 - 2 * HOUR);
    data.restore();
  }
});

test("the full cycle: email, then a new message starts a fresh 6 hours, then another email", async () => {
  const conversations = [{ _id: "c1", rcChannelId: "dm-rid", lastMessageAt: new Date(T0 - 2 * HOUR) }];
  const data = withData({ users: [student({ groupChats: [] })], conversations, groups: [], activatedAt: ACTIVATED });
  const f = fakes({ "s1@example.com": { "dm-rid": 1 } });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 1);

    // Nothing new: hours pass, no second email and no Rocket.Chat calls.
    assert.equal(await sweepUnreadMessageEmails(T0 + 5 * HOUR, f.deps), 0);
    assert.equal(f.asked.length, 1);

    // A new message arrives; the next tick starts the countdown from it.
    const message = T0 + 5 * HOUR + 10 * MIN;
    conversations[0].lastMessageAt = new Date(message);
    assert.equal(await sweepUnreadMessageEmails(T0 + 5 * HOUR + 15 * MIN, f.deps), 0);
    assert.equal(ms(data.user("s1").unreadEmailCountdownFrom), message);

    // A later message does not push the countdown back.
    conversations[0].lastMessageAt = new Date(message + 3 * HOUR);
    assert.equal(await sweepUnreadMessageEmails(message + 6 * HOUR - MIN, f.deps), 0);
    assert.equal(f.asked.length, 1);

    f.deps.countUnread = async (reader: any) => {
      f.asked.push(reader.email);
      return { "dm-rid": 2 };
    };
    assert.equal(await sweepUnreadMessageEmails(message + 6 * HOUR, f.deps), 1);
    assert.deepEqual(f.mails.map((m) => m.unreadCount), [1, 2]);
  } finally {
    data.restore();
  }
});

test("opening a chat resets the clock: no email until 6 hours after the visit", async () => {
  const data = withData({
    users: [student({ chatLastSeenAt: new Date(T0 - HOUR) })],
    ...ROOMS,
    activatedAt: ACTIVATED,
  });
  const f = fakes({ "s1@example.com": { "dm-rid": 4 } });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 0);
    assert.deepEqual(f.asked, []);
    assert.equal(await sweepUnreadMessageEmails(T0 + 5 * HOUR, f.deps), 1);
  } finally {
    data.restore();
  }
});

test("opted out, admin and blocked users are never checked or emailed", async () => {
  const users = [
    student({ _id: "a", email: "a@example.com", notificationPreferences: { email: false } }),
    student({ _id: "b", email: "b@example.com", role: "admin" }),
    student({ _id: "c", email: "c@example.com", status: "blocked" }),
  ];
  const data = withData({ users, ...ROOMS, activatedAt: ACTIVATED });
  const f = fakes({ "a@example.com": { "dm-rid": 1 }, "b@example.com": { "dm-rid": 1 }, "c@example.com": { "dm-rid": 1 } });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 0);
    assert.deepEqual(f.asked, []);
  } finally {
    data.restore();
  }
});

test("experts are emailed too, with their own dashboard role", async () => {
  const data = withData({ users: [student({ role: "expert" })], ...ROOMS, activatedAt: ACTIVATED });
  const f = fakes({ "s1@example.com": { "sem-rid": 2 } });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 1);
    assert.equal(f.mails[0].role, "expert");
  } finally {
    data.restore();
  }
});

test("Rocket.Chat unknown is not 'nothing unread', and repeated failures stop the tick", async () => {
  const users = ["u1", "u2", "u3", "u4"].map((id) => student({ _id: id, email: `${id}@example.com` }));
  const data = withData({ users, ...ROOMS, activatedAt: ACTIVATED });
  const f = fakes({
    "u1@example.com": null,
    "u2@example.com": null,
    "u3@example.com": null,
    "u4@example.com": { "dm-rid": 1 },
  });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 0);
    assert.equal(MAX_CONSECUTIVE_RC_FAILURES, 3);
    assert.deepEqual(f.asked, ["u1@example.com", "u2@example.com", "u3@example.com"]);
    assert.equal(data.user("u4").unreadEmailCheckedAt, undefined);
    // The users that could not be checked are backed off rather than retried every tick.
    assert.equal(ms(data.user("u1").unreadEmailCheckedAt), T0);
  } finally {
    data.restore();
  }
});

test("only consecutive failures stop the tick: a success in between resets the count", async () => {
  const ids = ["u1", "u2", "u3", "u4", "u5"];
  const users = ids.map((id) => student({ _id: id, email: `${id}@example.com` }));
  const data = withData({ users, ...ROOMS, activatedAt: ACTIVATED });
  const f = fakes({
    "u1@example.com": null,
    "u2@example.com": { "dm-rid": 1 },
    "u3@example.com": null,
    "u4@example.com": null,
    "u5@example.com": { "dm-rid": 1 },
  });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 2);
    assert.deepEqual(f.asked, ids.map((id) => `${id}@example.com`));
  } finally {
    data.restore();
  }
});

test("messages in a chat the bell does not count (a pending 1:1) never trigger a check", async () => {
  const groups = [
    { _id: "g1", rcChannelId: "appt-rid", type: "individual", status: "pending", lastMessageAt: new Date(T0 - HOUR) },
  ];
  const data = withData({
    users: [student({ directConversations: [] })],
    conversations: [],
    groups,
    activatedAt: ACTIVATED,
  });
  const f = fakes({ "s1@example.com": { "appt-rid": 2 } });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 0);
    assert.deepEqual(f.asked, []);
  } finally {
    data.restore();
  }
});

test("a single failure does not stop the tick", async () => {
  const users = ["u1", "u2"].map((id) => student({ _id: id, email: `${id}@example.com` }));
  const data = withData({ users, ...ROOMS, activatedAt: ACTIVATED });
  const f = fakes({ "u1@example.com": null, "u2@example.com": { "dm-rid": 1 } });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 1);
    assert.equal(f.mails[0].targetEmail, "u2@example.com");
  } finally {
    data.restore();
  }
});

test("a user who opens a chat while being checked is not emailed", async () => {
  const data = withData({ users: [student()], ...ROOMS, activatedAt: ACTIVATED });
  const f = fakes({
    "s1@example.com": () => {
      data.user("s1").chatLastSeenAt = new Date(T0);
      return { "dm-rid": 3 };
    },
  });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 0);
    assert.deepEqual(f.mails, []);
  } finally {
    data.restore();
  }
});

test("an email another server process sent while this one was checking is not sent twice", async () => {
  const data = withData({ users: [student()], ...ROOMS, activatedAt: ACTIVATED });
  const f = fakes({
    "s1@example.com": () => {
      data.user("s1").unreadEmailSentAt = new Date(T0 - MIN);
      return { "dm-rid": 3 };
    },
  });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 0);
    assert.deepEqual(f.mails, []);
  } finally {
    data.restore();
  }
});

test("an error for one user does not stop the others", async () => {
  const users = ["u1", "u2"].map((id) => student({ _id: id, email: `${id}@example.com` }));
  const data = withData({ users, ...ROOMS, activatedAt: ACTIVATED });
  const f = fakes({
    "u1@example.com": () => {
      throw new Error("boom");
    },
    "u2@example.com": { "dm-rid": 1 },
  });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 1);
  } finally {
    data.restore();
  }
});

test("overlapping ticks do not double-send", async () => {
  const data = withData({ users: [student()], ...ROOMS, activatedAt: ACTIVATED });
  const f = fakes({ "s1@example.com": { "dm-rid": 1 } });
  try {
    const [a, b] = await Promise.all([
      sweepUnreadMessageEmails(T0, f.deps),
      sweepUnreadMessageEmails(T0, f.deps),
    ]);
    assert.equal(a + b, 1);
    assert.equal(f.mails.length, 1);
    // The second tick is skipped outright, so Rocket.Chat is asked once, not twice.
    assert.equal(f.asked.length, 1);
  } finally {
    data.restore();
  }
});

test("a message stamped on another occurrence of a recurring seminar counts as activity", async () => {
  const groups = [
    { _id: "g1", rcChannelId: "sem-rid", type: "seminar", status: "active", lastMessageAt: null },
    { _id: "g2", rcChannelId: "sem-rid", type: "seminar", status: "active", lastMessageAt: new Date(T0 - HOUR) },
  ];
  const data = withData({
    users: [student({ directConversations: [] })],
    conversations: [],
    groups,
    activatedAt: ACTIVATED,
  });
  const f = fakes({ "s1@example.com": { "sem-rid": 2 } });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 1);
  } finally {
    data.restore();
  }
});

test("a community the user is a member of counts even if missing from their lists", async () => {
  const groups = [
    { _id: "g9", rcChannelId: "com-rid", type: "community", participants: ["s1"], lastMessageAt: new Date(T0 - HOUR) },
  ];
  const data = withData({
    users: [student({ directConversations: [], groupChats: [] })],
    conversations: [],
    groups,
    activatedAt: ACTIVATED,
  });
  const f = fakes({ "s1@example.com": { "com-rid": 6 } });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 1);
    assert.equal(f.mails[0].unreadCount, 6);
  } finally {
    data.restore();
  }
});

test("a user in no chat with any message is never checked", async () => {
  const data = withData({
    users: [student()],
    conversations: [{ _id: "c1", rcChannelId: "dm-rid", lastMessageAt: null }],
    groups: [{ _id: "g1", rcChannelId: "sem-rid", type: "seminar", lastMessageAt: null }],
    activatedAt: ACTIVATED,
  });
  const f = fakes({ "s1@example.com": { "dm-rid": 1 } });
  try {
    assert.equal(await sweepUnreadMessageEmails(T0, f.deps), 0);
    assert.deepEqual(f.asked, []);
  } finally {
    data.restore();
  }
});

// ── recordChatSeen ──────────────────────────────────────────────────────────

test("recordChatSeen writes at most once a minute and never touches updatedAt", async () => {
  const original = User.updateOne;
  const calls: any[] = [];
  User.updateOne = async (...args: any[]) => {
    calls.push(args);
    return { acknowledged: true };
  };
  try {
    await recordChatSeen("u1", T0);
    const [filter, update, options] = calls[0];
    assert.equal(filter._id, "u1");
    assert.deepEqual(filter.$or, [
      { chatLastSeenAt: null },
      { chatLastSeenAt: { $lt: new Date(T0 - MIN) } },
    ]);
    assert.equal(ms(update.$set.chatLastSeenAt), T0);
    assert.deepEqual(options, { timestamps: false });

    await recordChatSeen(null, T0);
    await recordChatSeen("", T0);
    assert.equal(calls.length, 1);
  } finally {
    User.updateOne = original;
  }
});

test("recordChatSeen never throws, so chat keeps working if the write fails", async () => {
  const original = User.updateOne;
  User.updateOne = async () => {
    throw new Error("db down");
  };
  try {
    await recordChatSeen("u1", T0);
  } finally {
    User.updateOne = original;
  }
});

// ── The email itself ────────────────────────────────────────────────────────

test("the email states the unread count and links to the right dashboard", async () => {
  const captured: any[] = [];
  const originalGlobal = (globalThis as any).sendNotificationEmail;
  (globalThis as any).sendNotificationEmail = async (to: any, subject: string, html: string) => {
    captured.push({ to, subject, html });
  };
  try {
    await notifications.sendUnreadMessagesEmail({
      targetEmail: "s1@example.com",
      userName: "Sam <b>",
      unreadCount: 3,
      role: "customer",
    });
    await notifications.sendUnreadMessagesEmail({
      targetEmail: "e1@example.com",
      userName: "Eve",
      unreadCount: 1,
      role: "expert",
    });

    assert.equal(captured[0].to, "s1@example.com");
    assert.equal(captured[0].subject, "You have 3 unread messages on WisdomLinked");
    assert.match(captured[0].html, /<strong>3<\/strong> unread messages/);
    assert.match(captured[0].html, /user\/studentdashboard/);
    assert.doesNotMatch(captured[0].html, /Sam <b>/);
    assert.match(captured[0].html, /turn them off in Settings/);

    assert.equal(captured[1].subject, "You have 1 unread message on WisdomLinked");
    assert.match(captured[1].html, /user\/expertdashboard/);
  } finally {
    (globalThis as any).sendNotificationEmail = originalGlobal;
  }
});
