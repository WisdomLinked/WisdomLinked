import test from "node:test";
import assert from "node:assert/strict";

const stripeController = require("../controllers/stripe.controller");
stripeController.sendBookingReceiptAndConfirmation = async () => {};

const notifications = require("../services/notifications");
notifications.sendNotificationEmail = async () => {};
(globalThis as any).sendNotificationEmail = async () => {};
notifications.scheduleEmailReminder = async () => {};

const groupController = require("../controllers/groupChat.controller");
const GroupChat = require("../models/GroupChat");
const User = require("../models/User");
const AppState = require("../models/AppState");
const SeminarSeatRequest = require("../models/SeminarSeatRequest");

const createRes = () => {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const IN_10_DAYS = new Date(Date.now() + 10 * 24 * 3600_000);

const seminar = (over: any = {}) => ({
  _id: "seminar-1",
  name: "Applying to US Graduate Programs",
  type: "seminar",
  status: "active",
  admin: "host-1",
  participants: ["host-1"],
  coModerators: [],
  price: 49,
  currency: "usd",
  duration: 90,
  start: IN_10_DAYS,
  maxAttendees: null,
  ...over,
});

const host = {
  _id: "host-1",
  username: "Dr Wang",
  email: "host@x.com",
  role: "expert",
  followers: ["student-1", "student-2"],
};

const student = (id: string, over: any = {}) => ({
  _id: id,
  username: `Student ${id}`,
  email: `${id}@x.com`,
  role: "customer",
  groupChats: [],
  save: async () => {},
  ...over,
});

const invite = async (body: any, userId = "host-1") => {
  const res = createRes();
  await groupController.inviteToSeminar({ user: { userId }, body }, res);
  return res;
};

const withStubs = async (chat: any, run: () => Promise<void>, opts: any = {}) => {
  const originals = {
    gcFindById: GroupChat.findById,
    gcFind: GroupChat.find,
    gcUpdateOne: GroupChat.updateOne,
    gcUpdateMany: GroupChat.updateMany,
    userFindById: User.findById,
    userUpdateOne: User.updateOne,
    appState: AppState.findOne,
    seatFindOne: SeminarSeatRequest.findOne,
    seatCreate: SeminarSeatRequest.create,
  };
  try {
    GroupChat.findById = (id: string) => {
      const doc = chat;
      const chainable: any = { select: () => chainable, then: (r: any, j: any) => Promise.resolve(doc).then(r, j) };
      return chainable;
    };
    GroupChat.find = () => ({ then: (r: any) => Promise.resolve([]).then(r) });
    GroupChat.updateOne = async () => ({});
    GroupChat.updateMany = async () => ({});
    User.updateOne = async () => ({});
    User.findById = (id: string) => {
      const doc = String(id) === "host-1" ? host : (opts.students?.[String(id)] ?? student(String(id)));
      const chainable: any = { select: () => chainable, then: (r: any, j: any) => Promise.resolve(doc).then(r, j) };
      return chainable;
    };
    AppState.findOne = async () => ({});
    SeminarSeatRequest.findOne = async () => opts.openRequest ?? null;
    SeminarSeatRequest.create = async (doc: any) => ({ ...doc, _id: `req-${doc.customer}` });
    await run();
  } finally {
    GroupChat.findById = originals.gcFindById;
    GroupChat.find = originals.gcFind;
    GroupChat.updateOne = originals.gcUpdateOne;
    GroupChat.updateMany = originals.gcUpdateMany;
    User.findById = originals.userFindById;
    User.updateOne = originals.userUpdateOne;
    AppState.findOne = originals.appState;
    SeminarSeatRequest.findOne = originals.seatFindOne;
    SeminarSeatRequest.create = originals.seatCreate;
  }
};

test("a paid seminar invites followers rather than enrolling them", async () => {
  await withStubs(seminar(), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["student-1", "student-2"] });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.free, false);
    assert.deepEqual(res.body.results.map((r: any) => r.outcome), ["invited", "invited"]);
  });
});

test("an invitation is marked host-origin so the student is not told they asked for it", async () => {
  const created: any[] = [];
  const originalCreate = SeminarSeatRequest.create;
  await withStubs(seminar(), async () => {
    SeminarSeatRequest.create = async (doc: any) => {
      created.push(doc);
      return { ...doc, _id: "req-1" };
    };
    await invite({ groupChatId: "seminar-1", followerIds: ["student-1"] });
    assert.equal(created[0].origin, "host");
    assert.equal(created[0].status, "awaiting_payment");
    assert.equal(created[0].amount, 4900, "the price is snapshotted in cents");
    assert.ok(created[0].paymentDeadline, "a paid invitation carries a deadline");
  });
  SeminarSeatRequest.create = originalCreate;
});

test("a free seminar enrols the follower instead of asking them to accept", async () => {
  await withStubs(seminar({ price: 0 }), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["student-1"] });
    assert.equal(res.body.free, true);
    assert.equal(res.body.results[0].outcome, "enrolled");
  });
});

test("only the host of the seminar may invite to it", async () => {
  await withStubs(seminar(), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["student-1"] }, "someone-else");
    assert.equal(res.statusCode, 403);
  });
});

test("a student who does not follow the host can still be invited", async () => {
  await withStubs(seminar(), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["stranger-9"] });
    assert.equal(res.body.results[0].outcome, "invited");
  });
});

test("an email address is resolved to the student behind it", async () => {
  const originalFindOne = User.findOne;
  try {
    User.findOne = (q: any) => {
      const doc = q?.email === "known@x.com" ? { _id: "student-9" } : null;
      const chainable: any = { select: () => chainable, then: (r: any, j: any) => Promise.resolve(doc).then(r, j) };
      return chainable;
    };
    await withStubs(seminar(), async () => {
      const res = await invite({ groupChatId: "seminar-1", emails: ["Known@X.com"] });
      assert.equal(res.body.results[0].outcome, "invited");
    });
  } finally {
    User.findOne = originalFindOne;
  }
});

test("an address with no account is reported, not silently dropped", async () => {
  const originalFindOne = User.findOne;
  try {
    User.findOne = () => {
      const chainable: any = { select: () => chainable, then: (r: any, j: any) => Promise.resolve(null).then(r, j) };
      return chainable;
    };
    await withStubs(seminar(), async () => {
      const res = await invite({ groupChatId: "seminar-1", emails: ["nobody@x.com"] });
      assert.equal(res.body.results[0].outcome, "no_account");
    });
  } finally {
    User.findOne = originalFindOne;
  }
});

test("a malformed address never reaches the database", async () => {
  await withStubs(seminar(), async () => {
    const res = await invite({ groupChatId: "seminar-1", emails: ["not-an-email"] });
    assert.equal(res.body.results[0].outcome, "bad_email");
  });
});

test("an address that resolves to someone already picked is not invited twice", async () => {
  const originalFindOne = User.findOne;
  try {
    User.findOne = () => {
      const chainable: any = { select: () => chainable, then: (r: any, j: any) => Promise.resolve({ _id: "student-1" }).then(r, j) };
      return chainable;
    };
    await withStubs(seminar(), async () => {
      const res = await invite({
        groupChatId: "seminar-1",
        followerIds: ["student-1"],
        emails: ["student-1@x.com"],
      });
      assert.equal(res.body.results.length, 1);
    });
  } finally {
    User.findOne = originalFindOne;
  }
});

test("an experts's own account is not invitable as a student", async () => {
  await withStubs(seminar(), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["student-1"] });
    assert.equal(res.body.results[0].outcome, "invited");
  }, { students: { "student-1": student("student-1") } });

  await withStubs(seminar(), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["student-1"] });
    assert.equal(res.body.results[0].outcome, "not_a_student");
  }, { students: { "student-1": student("student-1", { role: "expert" }) } });
});

test("someone already enrolled is reported, not invited twice", async () => {
  await withStubs(seminar({ participants: ["host-1", "student-1"] }), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["student-1"] });
    assert.equal(res.body.results[0].outcome, "already_enrolled");
  });
});

test("an open invitation is not duplicated", async () => {
  await withStubs(seminar(), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["student-1"] });
    assert.equal(res.body.results[0].outcome, "already_invited");
  }, { openRequest: { _id: "existing", status: "awaiting_payment" } });
});

test("a full seminar still invites, and says so", async () => {
  await withStubs(seminar({ maxAttendees: 0 }), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["student-1"] });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.results[0].outcome, "invited");
    assert.equal(res.body.seminarFull, true, "the host is told the seminar is over capacity");
  });
});

test("a seminar that already started can no longer be shared", async () => {
  await withStubs(seminar({ start: new Date(Date.now() - 3600_000) }), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["student-1"] });
    assert.equal(res.statusCode, 409);
  });
});

test("a cancelled seminar cannot be shared", async () => {
  await withStubs(seminar({ status: "cancelled" }), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["student-1"] });
    assert.equal(res.statusCode, 409);
  });
});

test("an empty or oversized selection is refused", async () => {
  await withStubs(seminar(), async () => {
    assert.equal((await invite({ groupChatId: "seminar-1", followerIds: [], emails: [] })).statusCode, 400);
    const many = Array.from({ length: 51 }, (_, i) => `s-${i}`);
    assert.equal((await invite({ groupChatId: "seminar-1", followerIds: many })).statusCode, 400);
  });
});

test("the same follower picked twice is invited once", async () => {
  await withStubs(seminar(), async () => {
    const res = await invite({ groupChatId: "seminar-1", followerIds: ["student-1", "student-1"] });
    assert.equal(res.body.results.length, 1);
  });
});
