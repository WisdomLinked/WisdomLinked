import test from "node:test";
import assert from "node:assert/strict";

const stripeController = require("../controllers/stripe.controller");
stripeController.sendBookingReceiptAndConfirmation = async () => {};

const notifications = require("../services/notifications");
notifications.sendNotificationEmail = async () => {};
(globalThis as any).sendNotificationEmail = async () => {};
notifications.sendSessionReminderEmail = async () => {};

const groupController = require("../controllers/groupChat.controller");
const GroupChat = require("../models/GroupChat");
const User = require("../models/User");
const AppState = require("../models/AppState");
const SeminarSeatRequest = require("../models/SeminarSeatRequest");

const IN_10_DAYS = new Date(Date.now() + 10 * 24 * 3600_000);
const IN_30_DAYS = new Date(Date.now() + 30 * 24 * 3600_000);

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

const seminar = (over: any = {}) => ({
  _id: "seminar-1",
  name: "Full Seminar",
  type: "seminar",
  status: "active",
  admin: "host-1",
  participants: ["host-1", "enrolled-1"],
  coModerators: [],
  price: 40,
  currency: "usd",
  duration: 60,
  start: IN_10_DAYS,
  maxAttendees: 1,
  ...over,
});

const user = (id: string, over: any = {}) => ({
  _id: id,
  username: id,
  email: `${id}@x.com`,
  role: id.startsWith("host") ? "expert" : "customer",
  timeZone: "UTC",
  groupChats: [],
  save: async () => {},
  ...over,
});

test("requestSeminarSeat joins interest waitlist far before start with no payment intent", async () => {
  const created: any[] = [];
  const originals = {
    gcFindOne: GroupChat.findOne,
    seatFindOne: SeminarSeatRequest.findOne,
    seatCreate: SeminarSeatRequest.create,
    seatCount: SeminarSeatRequest.countDocuments,
    userFindById: User.findById,
    appState: AppState.findOne,
  };
  try {
    AppState.findOne = async () => ({ stripeMode: "test" });
    GroupChat.findOne = async () => seminar({ start: IN_30_DAYS, maxAttendees: 1, participants: ["host-1", "s0"] });
    SeminarSeatRequest.countDocuments = async () => 0;
    SeminarSeatRequest.findOne = async () => null;
    SeminarSeatRequest.create = async (doc: any) => {
      created.push(doc);
      return { ...doc, _id: "req-new" };
    };
    User.findById = (id: string) => {
      const doc = user(String(id));
      return { then: (r: any, j: any) => Promise.resolve(doc).then(r, j) };
    };

    const res = createRes();
    await groupController.requestSeminarSeat(
      { user: { userId: "waiter-1" }, body: { groupChatId: "seminar-1" } },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, "pending");
    assert.equal(created.length, 1);
    assert.equal(created[0].paymentIntent, undefined);
    assert.equal(created[0].amount, 0);
    assert.equal(created[0].status, "pending");
  } finally {
    GroupChat.findOne = originals.gcFindOne;
    SeminarSeatRequest.findOne = originals.seatFindOne;
    SeminarSeatRequest.create = originals.seatCreate;
    SeminarSeatRequest.countDocuments = originals.seatCount;
    User.findById = originals.userFindById;
    AppState.findOne = originals.appState;
  }
});

test("offerNextWaitlistedSeat offers oldest interest pending as awaiting_payment for paid seminars", async () => {
  const updates: any[] = [];
  const originals = {
    gcFindById: GroupChat.findById,
    gcUpdateMany: GroupChat.updateMany,
    userFindById: User.findById,
    userUpdateOne: User.updateOne,
    appState: AppState.findOne,
    seatFind: SeminarSeatRequest.find,
    seatCount: SeminarSeatRequest.countDocuments,
    seatFindOneAndUpdate: SeminarSeatRequest.findOneAndUpdate,
  };

  // Cap 1 with only the host enrolled → one real seat to offer.
  const chat = seminar({
    maxAttendees: 1,
    participants: ["host-1"],
    price: 40,
  });

  try {
    GroupChat.findById = () => ({
      then: (r: any, j: any) => Promise.resolve(chat).then(r, j),
    });
    GroupChat.updateMany = async () => ({});
    User.updateOne = async () => ({});
    User.findById = (id: string) => {
      const doc = user(String(id));
      return { then: (r: any, j: any) => Promise.resolve(doc).then(r, j) };
    };
    AppState.findOne = async () => ({});
    let softHeld = 0;
    SeminarSeatRequest.countDocuments = async () => softHeld;
    SeminarSeatRequest.find = () => ({
      sort: () => ({
        limit: async () => [
          {
            _id: "req-old",
            customer: "waiter-old",
            groupChat: "seminar-1",
            status: "pending",
            amount: 0,
            createdAt: new Date(Date.now() - 60_000),
          },
          {
            _id: "req-new",
            customer: "waiter-new",
            groupChat: "seminar-1",
            status: "pending",
            amount: 0,
            createdAt: new Date(),
          },
        ],
      }),
    });
    SeminarSeatRequest.findOneAndUpdate = async (filter: any, update: any) => {
      updates.push({ filter, update });
      if (update?.$set?.status === "awaiting_payment") softHeld += 1;
      return { _id: filter._id, ...update.$set };
    };

    const offered = await groupController.offerNextWaitlistedSeat("seminar-1");
    assert.equal(offered, true);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].filter._id, "req-old");
    assert.equal(updates[0].update.$set.status, "awaiting_payment");
    assert.equal(updates[0].update.$set.amount, 4120);
    assert.ok(updates[0].update.$set.paymentDeadline);
    assert.ok(String(updates[0].update.$set.decisionNote || "").includes("seat opened"));
    // Homepage notice fields are set so DecisionNotices can surface the offer.
    assert.ok(updates[0].update.$set.decisionNoteAt);
    assert.equal(updates[0].update.$set.decisionNoteReadAt, null);
    // Deep-link helper used by the offer email CTA (emails use a closed-over binding).
    const { seminarStudentDashboardUrl } = require("../utils/appBaseUrl");
    assert.match(seminarStudentDashboardUrl("seminar-1"), /seminar=seminar-1/);
  } finally {
    GroupChat.findById = originals.gcFindById;
    GroupChat.updateMany = originals.gcUpdateMany;
    User.findById = originals.userFindById;
    User.updateOne = originals.userUpdateOne;
    AppState.findOne = originals.appState;
    SeminarSeatRequest.find = originals.seatFind;
    SeminarSeatRequest.countDocuments = originals.seatCount;
    SeminarSeatRequest.findOneAndUpdate = originals.seatFindOneAndUpdate;
  }
});

test("offerNextWaitlistedSeat offers a $0 seat for the platform fee and skips legacy held rows", async () => {
  const updates: any[] = [];
  const originals = {
    gcFindById: GroupChat.findById,
    gcFindOneAndUpdate: GroupChat.findOneAndUpdate,
    gcFind: GroupChat.find,
    gcUpdateMany: GroupChat.updateMany,
    userFindById: User.findById,
    userUpdateOne: User.updateOne,
    seatFind: SeminarSeatRequest.find,
    seatCount: SeminarSeatRequest.countDocuments,
    seatFindOneAndUpdate: SeminarSeatRequest.findOneAndUpdate,
    appState: AppState.findOne,
  };

  const chat = seminar({
    maxAttendees: 2,
    participants: ["host-1"],
    price: 0,
  });

  try {
    AppState.findOne = async () => ({ stripeMode: "test" });
    GroupChat.findById = () => ({
      then: (r: any, j: any) => Promise.resolve(chat).then(r, j),
      populate: () => ({
        populate: () => ({ then: (r: any, j: any) => Promise.resolve(chat).then(r, j) }),
      }),
    });
    GroupChat.find = () => ({ then: (r: any) => Promise.resolve([]).then(r) });
    GroupChat.findOneAndUpdate = async (_filter: any, update: any) => {
      if (update?.$addToSet?.participants) {
        const uid = update.$addToSet.participants;
        if (!chat.participants.includes(uid)) chat.participants.push(uid);
      }
      return { ...chat };
    };
    GroupChat.updateMany = async () => ({});
    User.updateOne = async () => ({});
    User.findById = (id: string) => {
      const doc = user(String(id));
      return { then: (r: any, j: any) => Promise.resolve(doc).then(r, j) };
    };
    SeminarSeatRequest.countDocuments = async () => 0;
    SeminarSeatRequest.find = () => ({
      sort: () => ({
        limit: async () => [
          {
            _id: "req-held",
            customer: "legacy-1",
            status: "pending",
            paymentIntent: "pi_legacy",
            amount: 4000,
          },
          {
            _id: "req-free",
            customer: "waiter-free",
            status: "pending",
            amount: 0,
          },
        ],
      }),
    });
    SeminarSeatRequest.findOneAndUpdate = async (filter: any, update: any) => {
      updates.push({ filter, update });
      return { _id: filter._id, ...update.$set };
    };

    const offered = await groupController.offerNextWaitlistedSeat("seminar-1");
    assert.equal(offered, true);
    assert.equal(updates[0].filter._id, "req-free");
    assert.equal(updates[0].update.$set.status, "awaiting_payment");
    assert.equal(updates[0].update.$set.amount, 100, "the free-session platform fee, tax 0");
    assert.ok(updates[0].update.$set.paymentDeadline);
    assert.ok(!chat.participants.includes("waiter-free"), "the student is not enrolled until they pay");
  } finally {
    GroupChat.findById = originals.gcFindById;
    GroupChat.findOneAndUpdate = originals.gcFindOneAndUpdate;
    GroupChat.find = originals.gcFind;
    GroupChat.updateMany = originals.gcUpdateMany;
    User.findById = originals.userFindById;
    User.updateOne = originals.userUpdateOne;
    SeminarSeatRequest.find = originals.seatFind;
    SeminarSeatRequest.countDocuments = originals.seatCount;
    SeminarSeatRequest.findOneAndUpdate = originals.seatFindOneAndUpdate;
    AppState.findOne = originals.appState;
  }
});

test("soft-held awaiting_payment seat blocks a second student from claiming it", async () => {
  // Cap 1, only host enrolled, but one soft offer → register must not enroll.
  const chat = seminar({
    maxAttendees: 1,
    participants: ["host-1"],
    price: 0,
  });
  const created: any[] = [];
  const originals = {
    gcFindOne: GroupChat.findOne,
    gcFindById: GroupChat.findById,
    gcFindOneAndUpdate: GroupChat.findOneAndUpdate,
    seatCount: SeminarSeatRequest.countDocuments,
    seatFindOne: SeminarSeatRequest.findOne,
    seatCreate: SeminarSeatRequest.create,
    userFindById: User.findById,
    appState: AppState.findOne,
  };
  try {
    AppState.findOne = async () => ({ stripeMode: "test" });
    GroupChat.findOne = async () => chat;
    GroupChat.findById = () => ({
      then: (r: any, j: any) => Promise.resolve(chat).then(r, j),
    });
    // Soft hold fills the only seat — claim must refuse without adding participants.
    SeminarSeatRequest.countDocuments = async () => 1;
    GroupChat.findOneAndUpdate = async () => {
      throw new Error("claimSeminarSeat must not hit findOneAndUpdate when soft-held full");
    };
    SeminarSeatRequest.findOne = async () => null;
    SeminarSeatRequest.create = async (doc: any) => {
      created.push(doc);
      return { ...doc, _id: "req-wait" };
    };
    User.findById = (id: string) => {
      const doc = user(String(id));
      return { then: (r: any, j: any) => Promise.resolve(doc).then(r, j) };
    };

    const res = createRes();
    await groupController.registerForSeminar(
      {
        user: { userId: "intruder-1" },
        body: { groupChatId: "seminar-1", payment_intent: "0" },
      },
      res,
    );
    assert.ok(!chat.participants.includes("intruder-1"), "must not enroll into a soft-held seat");
    // Claim fails → treated as full → interest waitlist join.
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.status, "pending");
    assert.equal(created.length, 1);
  } finally {
    GroupChat.findOne = originals.gcFindOne;
    GroupChat.findById = originals.gcFindById;
    GroupChat.findOneAndUpdate = originals.gcFindOneAndUpdate;
    SeminarSeatRequest.countDocuments = originals.seatCount;
    SeminarSeatRequest.findOne = originals.seatFindOne;
    SeminarSeatRequest.create = originals.seatCreate;
    User.findById = originals.userFindById;
    AppState.findOne = originals.appState;
  }
});

test("atomic claim refuses when another student already took the only seat (pay-path gate)", async () => {
  // Mirrors paySeminarSeatRequest after a soft offer: excludeOwnSoftHold → softHeld 0,
  // but enrolled already at cap → claimSeminarSeat returns null (no overfill).
  const { claimableSeatCap, seminarIsFull, occupiedSeminarSeats } = require("../utils/seminarCapacity");
  const chat = seminar({
    maxAttendees: 1,
    participants: ["host-1", "thief-1"],
    price: 40,
  });
  assert.equal(occupiedSeminarSeats(chat, 0), 1);
  assert.equal(seminarIsFull(chat, 0), true);
  assert.equal(claimableSeatCap(1, 0), 1);

  const originals = {
    gcFindOne: GroupChat.findOne,
    gcFindById: GroupChat.findById,
    gcFindOneAndUpdate: GroupChat.findOneAndUpdate,
    seatCount: SeminarSeatRequest.countDocuments,
    seatFindOne: SeminarSeatRequest.findOne,
    seatCreate: SeminarSeatRequest.create,
    userFindById: User.findById,
    appState: AppState.findOne,
  };
  try {
    AppState.findOne = async () => ({ stripeMode: "test" });
    GroupChat.findOne = async () => ({ ...chat, price: 0 });
    GroupChat.findById = () => ({
      then: (r: any, j: any) => Promise.resolve({ ...chat, price: 0 }).then(r, j),
    });
    SeminarSeatRequest.countDocuments = async () => 0;
    // Enrolled at cap: findOneAndUpdate must not add the waiter.
    GroupChat.findOneAndUpdate = async () => null;
    SeminarSeatRequest.findOne = async () => null;
    SeminarSeatRequest.create = async (doc: any) => ({ ...doc, _id: "req-rejoin" });
    User.findById = (id: string) => {
      const doc = user(String(id));
      return { then: (r: any, j: any) => Promise.resolve(doc).then(r, j) };
    };

    const res = createRes();
    await groupController.registerForSeminar(
      {
        user: { userId: "waiter-1" },
        body: { groupChatId: "seminar-1", payment_intent: "0" },
      },
      res,
    );
    assert.ok(!chat.participants.includes("waiter-1"), "must not overfill past maxAttendees");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.status, "pending");
  } finally {
    GroupChat.findOne = originals.gcFindOne;
    GroupChat.findById = originals.gcFindById;
    GroupChat.findOneAndUpdate = originals.gcFindOneAndUpdate;
    SeminarSeatRequest.countDocuments = originals.seatCount;
    SeminarSeatRequest.findOne = originals.seatFindOne;
    SeminarSeatRequest.create = originals.seatCreate;
    User.findById = originals.userFindById;
    AppState.findOne = originals.appState;
  }
});

test("approveSeminarSeatRequest rejects interest-only waitlist rows", async () => {
  const originals = {
    seatFindById: SeminarSeatRequest.findById,
    gcFindById: GroupChat.findById,
  };
  try {
    SeminarSeatRequest.findById = async () => ({
      _id: "req-1",
      status: "pending",
      groupChat: "seminar-1",
      customer: "waiter-1",
      amount: 0,
    });
    GroupChat.findById = async () => seminar();

    const res = createRes();
    await groupController.approveSeminarSeatRequest(
      { user: { userId: "host-1" }, body: { requestId: "req-1" } },
      res,
    );
    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /automatically/i);
  } finally {
    SeminarSeatRequest.findById = originals.seatFindById;
    GroupChat.findById = originals.gcFindById;
  }
});
