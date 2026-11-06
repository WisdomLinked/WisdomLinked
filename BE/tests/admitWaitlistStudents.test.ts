import test from "node:test";
import assert from "node:assert/strict";

const stripeController = require("../controllers/stripe.controller");
stripeController.sendBookingReceiptAndConfirmation = async () => {};

const notifications = require("../services/notifications");
notifications.sendNotificationEmail = async () => {};
(globalThis as any).sendNotificationEmail = async () => {};

const groupController = require("../controllers/groupChat.controller");
const GroupChat = require("../models/GroupChat");
const User = require("../models/User");
const AppState = require("../models/AppState");
const SeminarSeatRequest = require("../models/SeminarSeatRequest");
const { raisedSeatCap, waitlistSeminarIsOpen, firstFullFutureOccurrence } = require("../utils/seminarCapacity");

const DAY = 24 * 3600_000;
const IN_10_DAYS = new Date(Date.now() + 10 * DAY);

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
  _id: "sem-1",
  name: "Full Seminar",
  type: "seminar",
  status: "active",
  admin: "host-1",
  participants: ["host-1", "enrolled-1"],
  price: 40,
  currency: "usd",
  duration: 60,
  start: IN_10_DAYS,
  maxAttendees: 1,
  ...over,
});

const waiter = (index: number, over: any = {}) => ({
  _id: `req-${index}`,
  customer: `waiter-${index}`,
  groupChat: "sem-1",
  status: "pending",
  amount: 0,
  createdAt: new Date(Date.now() - (1000 - index) * 60_000),
  ...over,
});

const thenable = (value: any) => ({
  select: async () => value,
  then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject),
});

// An in-memory stand-in for the two collections, so the real offer loop runs against it.
const withStore = async (
  seminars: any[],
  requests: any[],
  run: (store: { seminars: any[]; requests: any[]; capWrites: any[] }) => Promise<void>,
) => {
  const originals = {
    gcFindById: GroupChat.findById,
    gcFind: GroupChat.find,
    gcUpdateOne: GroupChat.updateOne,
    userFindById: User.findById,
    userFind: User.find,
    appState: AppState.findOne,
    seatFind: SeminarSeatRequest.find,
    seatCount: SeminarSeatRequest.countDocuments,
    seatDistinct: SeminarSeatRequest.distinct,
    seatFindOneAndUpdate: SeminarSeatRequest.findOneAndUpdate,
    seatUpdateOne: SeminarSeatRequest.updateOne,
    seatUpdateMany: SeminarSeatRequest.updateMany,
  };
  const store = { seminars, requests, capWrites: [] as any[] };
  const seminarById = (id: any) => store.seminars.find((s) => String(s._id) === String(id)) || null;
  const seatsFor = (filter: any) => store.requests.filter((r) => {
    if (filter._id?.$in) return filter._id.$in.includes(r._id);
    const onSeminar = filter.groupChat?.$in
      ? filter.groupChat.$in.map(String).includes(String(r.groupChat))
      : String(r.groupChat) === String(filter.groupChat);
    return onSeminar && r.status === filter.status;
  });
  try {
    GroupChat.findById = (id: any) => thenable(seminarById(id));
    GroupChat.find = (filter: any) => {
      const rows = () => store.seminars.filter((s) =>
        s.seriesId === filter.seriesId
        && s.status === filter.status
        && (!filter._id?.$ne || s._id !== filter._id.$ne)
        && (!filter.start?.$gt || new Date(s.start) > filter.start.$gt));
      const query: any = {
        select: () => query,
        sort: () => query,
        then: (resolve: any, reject: any) => Promise.resolve(rows()).then(resolve, reject),
      };
      return query;
    };
    GroupChat.updateOne = async (filter: any, update: any) => {
      const target = seminarById(filter._id);
      const cap = update?.$max?.maxAttendees;
      if (typeof cap === "number" && typeof target?.maxAttendees === "number") {
        store.capWrites.push({ id: filter._id, cap });
        target.maxAttendees = Math.max(target.maxAttendees, cap);
      }
      return {};
    };
    User.findById = (id: any) => thenable({
      _id: String(id),
      username: String(id),
      email: `${id}@x.com`,
      timeZone: "UTC",
      groupChats: [],
      save: async () => {},
    });
    User.find = (filter: any) => ({
      select: async () => filter._id.$in
        .filter((id: any) => !String(id).startsWith("gone-") && !String(id).startsWith("blocked-"))
        .map((id: any) => ({ _id: id })),
    });
    AppState.findOne = async () => ({});
    SeminarSeatRequest.updateMany = async (filter: any, update: any) => {
      store.requests
        .filter((r) => filter._id.$in.includes(r._id) && r.status === filter.status)
        .forEach((r) => Object.assign(r, update.$set));
      return {};
    };
    SeminarSeatRequest.find = (filter: any) => {
      const rows = () => seatsFor(filter)
        .slice()
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return {
        select: async () => rows(),
        sort: () => ({
          limit: async (n: number) => rows().slice(0, n),
          then: (resolve: any, reject: any) => Promise.resolve(rows()).then(resolve, reject),
        }),
      };
    };
    SeminarSeatRequest.countDocuments = async (filter: any) => seatsFor(filter).length;
    SeminarSeatRequest.distinct = async (field: string, filter: any) =>
      Array.from(new Set(seatsFor(filter).map((r: any) => r[field])));
    SeminarSeatRequest.findOneAndUpdate = async (filter: any, update: any) => {
      const row = store.requests.find((r) => r._id === filter._id && r.status === filter.status);
      if (!row) return null;
      Object.assign(row, update.$set);
      return row;
    };
    SeminarSeatRequest.updateOne = async (filter: any, update: any) => {
      const row = store.requests.find((r) => r._id === filter._id && r.status === filter.status);
      if (row) Object.assign(row, update.$set);
      return {};
    };
    await run(store);
  } finally {
    GroupChat.findById = originals.gcFindById;
    GroupChat.find = originals.gcFind;
    GroupChat.updateOne = originals.gcUpdateOne;
    User.findById = originals.userFindById;
    User.find = originals.userFind;
    AppState.findOne = originals.appState;
    SeminarSeatRequest.updateMany = originals.seatUpdateMany;
    SeminarSeatRequest.find = originals.seatFind;
    SeminarSeatRequest.countDocuments = originals.seatCount;
    SeminarSeatRequest.distinct = originals.seatDistinct;
    SeminarSeatRequest.findOneAndUpdate = originals.seatFindOneAndUpdate;
    SeminarSeatRequest.updateOne = originals.seatUpdateOne;
  }
};

const admit = async (body: any, userId = "host-1") => {
  const res = createRes();
  await groupController.admitWaitlistStudents(
    { user: { userId }, body: { groupChatId: "sem-1", ...body } },
    res,
  );
  return res;
};

const statuses = (requests: any[]) => requests.map((r) => r.status);

test("raisedSeatCap only ever raises, and leaves an unlimited seminar alone", () => {
  assert.equal(raisedSeatCap(50, 50, 3), 53);
  assert.equal(raisedSeatCap(50, 48, 1), 50);
  assert.equal(raisedSeatCap(0, 0, 2), 2);
  assert.equal(raisedSeatCap(null, 10, 2), null);
  assert.equal(raisedSeatCap(undefined, 10, 2), null);
});

test("waitlistSeminarIsOpen is false once cancelled, started or missing", () => {
  const now = Date.now();
  assert.equal(waitlistSeminarIsOpen({ status: "active", start: new Date(now + 1000) }, now), true);
  assert.equal(waitlistSeminarIsOpen({ status: "active", start: new Date(now - 1000) }, now), false);
  assert.equal(waitlistSeminarIsOpen({ status: "active", start: new Date(now) }, now), false);
  assert.equal(waitlistSeminarIsOpen({ status: "cancelled", start: new Date(now + 1000) }, now), false);
  assert.equal(waitlistSeminarIsOpen(null, now), false);
});

test("admitting a number offers the longest-waiting students and raises the cap to fit", async () => {
  // Listed newest first, to prove the order comes from when they joined.
  const requests = [waiter(3), waiter(1), waiter(2)];
  await withStore([seminar()], requests, async (store) => {
    const res = await admit({ count: 2 });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.admitted, 2);
    assert.equal(res.body.awaitingPayment, 2);
    assert.equal(res.body.enrolled, 0);
    assert.equal(res.body.stillWaiting, 1);
    assert.equal(res.body.previousMaxAttendees, 1);
    assert.equal(res.body.maxAttendees, 3);
    assert.equal(store.seminars[0].maxAttendees, 3);
    assert.deepEqual(
      statuses(store.requests),
      ["pending", "awaiting_payment", "awaiting_payment"],
    );
    assert.ok(requests[1].paymentDeadline);
    assert.ok(requests[1].amount > 0);
  });
});

test("All admits everyone, past the usual limit of 25 per run", async () => {
  const requests = Array.from({ length: 30 }, (_, i) => waiter(i));
  await withStore([seminar()], requests, async (store) => {
    const res = await admit({ all: true });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.admitted, 30);
    assert.equal(res.body.stillWaiting, 0);
    assert.equal(store.seminars[0].maxAttendees, 31);
  });
});

test("a run with no limit still stops at 25 offers", async () => {
  const requests = Array.from({ length: 30 }, (_, i) => waiter(i));
  await withStore([seminar({ maxAttendees: 100 })], requests, async (store) => {
    await groupController.offerNextWaitlistedSeat("sem-1");
    assert.equal(store.requests.filter((r) => r.status === "awaiting_payment").length, 25);
  });
});

test("a number above the waitlist size admits only those waiting", async () => {
  await withStore([seminar()], [waiter(1), waiter(2)], async (store) => {
    const res = await admit({ count: 99 });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.admitted, 2);
    assert.equal(store.seminars[0].maxAttendees, 3);
  });
});

test("free seats mean no raise, and only the requested number is admitted", async () => {
  const requests = [waiter(1), waiter(2), waiter(3)];
  await withStore([seminar({ maxAttendees: 10 })], requests, async (store) => {
    const res = await admit({ count: 1 });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.admitted, 1);
    assert.equal(res.body.maxAttendees, 10);
    assert.deepEqual(statuses(requests), ["awaiting_payment", "pending", "pending"]);
    assert.equal(store.seminars[0].maxAttendees, 10);
  });
});

test("seats already held for unpaid offers are counted when raising the cap", async () => {
  const held = waiter(0, { status: "awaiting_payment", amount: 4120 });
  await withStore(
    [seminar({ maxAttendees: 2 })],
    [held, waiter(1)],
    async (store) => {
      const res = await admit({ count: 1 });
      assert.equal(res.statusCode, 200);
      assert.equal(store.seminars[0].maxAttendees, 3);
    },
  );
});

test("an unlimited seminar stays unlimited", async () => {
  await withStore([seminar({ maxAttendees: null })], [waiter(1)], async (store) => {
    const res = await admit({ count: 1 });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.maxAttendees, null);
    assert.equal(store.seminars[0].maxAttendees, null);
    assert.deepEqual(store.capWrites, []);
  });
});

test("recurring: future dates rise to fit, counting unpaid offers; past dates do not", async () => {
  const held = waiter(0, { status: "awaiting_payment", amount: 4120 });
  const past = seminar({
    _id: "sem-past",
    seriesId: "series-1",
    start: new Date(Date.now() - DAY),
    maxAttendees: 2,
  });
  const future = seminar({
    _id: "sem-future",
    seriesId: "series-1",
    start: new Date(Date.now() + 20 * DAY),
    maxAttendees: 2,
  });
  const roomy = seminar({
    _id: "sem-roomy",
    seriesId: "series-1",
    start: new Date(Date.now() + 30 * DAY),
    maxAttendees: 50,
  });
  const anchor = seminar({ seriesId: "series-1", maxAttendees: 2 });
  await withStore([anchor, past, future, roomy], [held, waiter(1), waiter(2)], async (store) => {
    const res = await admit({ count: 2 });
    assert.equal(res.statusCode, 200);
    assert.equal(anchor.maxAttendees, 4);
    // 1 enrolled + 1 unpaid offer on the anchor + 2 admitted.
    assert.equal(future.maxAttendees, 4);
    assert.equal(roomy.maxAttendees, 50);
    assert.equal(past.maxAttendees, 2);
    // Future dates are raised before anyone gets an offer they could pay for.
    assert.equal(store.capWrites[0].id, "sem-future");
  });
});

const seriesDates = (maxAttendees: number) => [
  seminar({ seriesId: "series-1", maxAttendees }),
  seminar({
    _id: "sem-later",
    seriesId: "series-1",
    start: new Date(Date.now() + 20 * DAY),
    maxAttendees,
  }),
];

test("recurring: an offer on one date holds a seat on the other dates", async () => {
  const dates = seriesDates(3);
  const offer = waiter(0, { status: "awaiting_payment", amount: 4120 });
  const waitingLater = waiter(1, { groupChat: "sem-later" });
  await withStore(dates, [offer, waitingLater], async () => {
    assert.equal(await groupController.countSoftHeldSeats("sem-later"), 1);
    await groupController.offerNextWaitlistedSeat("sem-later");
    // 1 enrolled + the first date's offer leaves one seat, which this waiter is offered.
    assert.equal(waitingLater.status, "awaiting_payment");
    assert.equal(await groupController.countSoftHeldSeats("sem-1"), 2);
  });

  const full = seriesDates(2);
  const offerFull = waiter(0, { status: "awaiting_payment", amount: 4120 });
  const stillWaiting = waiter(1, { groupChat: "sem-later" });
  await withStore(full, [offerFull, stillWaiting], async () => {
    await groupController.offerNextWaitlistedSeat("sem-later");
    assert.equal(stillWaiting.status, "pending");
  });
});

test("recurring: one student with offers on two dates needs one seat", async () => {
  const dates = seriesDates(3);
  const first = waiter(0, { status: "awaiting_payment", amount: 4120, customer: "same" });
  const second = waiter(1, { status: "awaiting_payment", amount: 4120, customer: "same", groupChat: "sem-later" });
  await withStore(dates, [first, second], async () => {
    assert.equal(await groupController.countSoftHeldSeats("sem-1"), 1);
  });
});

test("recurring: no offer is made while a later date has no room", async () => {
  const [first, later] = seriesDates(1);
  first.maxAttendees = 2;
  const row = waiter(0);
  await withStore([first, later], [row], async () => {
    await groupController.offerNextWaitlistedSeat("sem-1");
    assert.equal(row.status, "pending");
    later.maxAttendees = 2;
    await groupController.offerNextWaitlistedSeat("sem-1");
    assert.equal(row.status, "awaiting_payment");
  });
});

test("recurring: a later date's fullness counts offers held elsewhere", () => {
  const later = seminar({ maxAttendees: 3, participants: ["host-1", "a", "b"] });
  assert.equal(firstFullFutureOccurrence([later]), null);
  assert.equal(firstFullFutureOccurrence([later], Date.now(), 1), later);
  const past = seminar({ start: new Date(Date.now() - DAY), maxAttendees: 1 });
  assert.equal(firstFullFutureOccurrence([past], Date.now(), 5), null);
});

test("recurring: a released offer reaches a waitlist on another date", async () => {
  const dates = seriesDates(2);
  const held = waiter(0, { status: "awaiting_payment", amount: 4120 });
  const later = waiter(1, { groupChat: "sem-later" });
  await withStore(dates, [held, later], async () => {
    const seatFind = SeminarSeatRequest.find;
    SeminarSeatRequest.find = (filter: any) => (filter.customer
      ? Promise.resolve([held])
      : seatFind(filter)) as any;
    try {
      await groupController.releaseOffersOfBlockedUser(held.customer);
    } finally {
      SeminarSeatRequest.find = seatFind;
    }
    assert.equal(later.status, "awaiting_payment");
  });
});

test("blocking a student releases their offer to the next in line", async () => {
  const held = waiter(0, { status: "awaiting_payment", amount: 4120 });
  const next = waiter(1);
  const dates = [seminar({ maxAttendees: 2 })];
  await withStore(dates, [held, next], async () => {
    const seatFind = SeminarSeatRequest.find;
    SeminarSeatRequest.find = (filter: any) => (filter.customer
      ? Promise.resolve([held].filter((r) => r.customer === filter.customer && r.status === filter.status))
      : seatFind(filter)) as any;
    try {
      await groupController.releaseOffersOfBlockedUser(held.customer);
    } finally {
      SeminarSeatRequest.find = seatFind;
    }
    assert.equal(held.status, "expired");
    assert.equal(next.status, "awaiting_payment");
  });
});

test("older requests with a payment hold are left for Accept or Decline", async () => {
  const legacy = waiter(0, { paymentIntent: "pi_old", amount: 4120 });
  await withStore([seminar()], [legacy, waiter(1)], async () => {
    const res = await admit({ all: true });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.admitted, 1);
    assert.equal(res.body.stillWaiting, 0);
    // Room for the one admitted student, not for the held request as well.
    assert.equal(res.body.maxAttendees, 2);
    assert.equal(legacy.status, "pending");
  });
});

test("nothing changes when the request is refused", async () => {
  const refusals: Array<[string, any, any, string, number]> = [
    ["another expert", seminar(), { count: 1 }, "host-2", 409],
    ["a started seminar", seminar({ start: new Date(Date.now() - 1000) }), { count: 1 }, "host-1", 409],
    ["a cancelled seminar", seminar({ status: "cancelled" }), { count: 1 }, "host-1", 409],
    ["a community", seminar({ type: "community" }), { count: 1 }, "host-1", 404],
    ["a count of 0", seminar(), { count: 0 }, "host-1", 400],
    ["a negative count", seminar(), { count: -1 }, "host-1", 400],
    ["a fractional count", seminar(), { count: 1.5 }, "host-1", 400],
    ["text as a count", seminar(), { count: "abc" }, "host-1", 400],
    ["no count at all", seminar(), {}, "host-1", 400],
    ["all sent as text", seminar(), { all: "true" }, "host-1", 400],
  ];
  for (const [label, chat, body, userId, code] of refusals) {
    const requests = [waiter(1)];
    await withStore([chat], requests, async (store) => {
      const res = await admit(body, userId);
      assert.equal(res.statusCode, code, label);
      assert.deepEqual(store.capWrites, [], label);
      assert.equal(requests[0].status, "pending", label);
    });
  }
});

test("deleted, blocked and already-enrolled students are settled, not admitted", async () => {
  const gone = waiter(1, { customer: "gone-1" });
  const blocked = waiter(2, { customer: "blocked-1" });
  const inAlready = waiter(3, { customer: "enrolled-1" });
  const real = waiter(4);
  await withStore([seminar()], [gone, blocked, inAlready, real], async (store) => {
    const res = await admit({ all: true });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.admitted, 1);
    assert.equal(res.body.enrolled, 0);
    assert.equal(res.body.maxAttendees, 2);
    assert.equal(gone.status, "failed");
    assert.equal(blocked.status, "failed");
    assert.equal(inAlready.status, "approved");
    assert.equal(real.status, "awaiting_payment");
    assert.equal(store.seminars[0].maxAttendees, 2);
  });
});

test("a waitlist of only unusable students is refused without raising the cap", async () => {
  await withStore([seminar()], [waiter(1, { customer: "gone-1" })], async (store) => {
    const res = await admit({ all: true });
    assert.equal(res.statusCode, 409);
    assert.deepEqual(store.capWrites, []);
  });
});

test("an automatic offer skips a blocked student for the next one", async () => {
  const blocked = waiter(1, { customer: "blocked-1" });
  const next = waiter(2);
  await withStore([seminar({ maxAttendees: 2 })], [blocked, next], async () => {
    const realFindById = User.findById;
    User.findById = (id: any) => (String(id).startsWith("blocked-")
      ? thenable({ _id: String(id), status: "blocked", email: "b@x.com" })
      : realFindById(id));
    try {
      await groupController.offerNextWaitlistedSeat("sem-1");
    } finally {
      User.findById = realFindById;
    }
    assert.equal(blocked.status, "failed");
    assert.equal(next.status, "awaiting_payment");
  });
});

test("a seat cannot be paid for once its seminar has closed", async () => {
  const stripeController2 = require("../controllers/stripe.controller");
  const held = waiter(1, { status: "awaiting_payment", amount: 4120, paymentDeadline: new Date(Date.now() + DAY) });
  const closedSeminars: Array<[string, any]> = [
    ["deleted", null],
    ["cancelled", seminar({ status: "cancelled" })],
    ["started", seminar({ start: new Date(Date.now() - 1000) })],
  ];
  const originals = { seat: SeminarSeatRequest.findById, chat: GroupChat.findById, app: AppState.findOne };
  try {
    AppState.findOne = async () => ({ stripeMode: "test" });
    SeminarSeatRequest.findById = async () => held;
    for (const [label, chat] of closedSeminars) {
      GroupChat.findById = async () => chat;
      const res = createRes();
      await stripeController2.createStripePaymentIntent(
        { user: { userId: "waiter-1" }, body: { seatRequestId: "req-1", paymentMethod: "card" } },
        res,
      );
      assert.equal(res.statusCode, 409, label);
    }
  } finally {
    SeminarSeatRequest.findById = originals.seat;
    GroupChat.findById = originals.chat;
    AppState.findOne = originals.app;
  }
});

test("deleting a seminar closes its open seats", async () => {
  const offered = waiter(1, { status: "awaiting_payment", amount: 4120 });
  const waitingRow = waiter(2);
  const legacy = waiter(3, { paymentIntent: "pi_old", amount: 4120 });
  await withStore([seminar()], [offered, waitingRow, legacy], async () => {
    const originals = {
      gcFindOne: GroupChat.findOne,
      gcDeleteMany: GroupChat.deleteMany,
      seatFindOpen: SeminarSeatRequest.find,
    };
    GroupChat.findOne = async () => seminar();
    GroupChat.deleteMany = async () => ({});
    SeminarSeatRequest.find = async () => [offered, waitingRow, legacy];
    try {
      const res = createRes();
      await groupController.deleteGroup(
        { user: { userId: "host-1" }, body: { groupChatId: "sem-1" } },
        res,
      );
      assert.equal(res.statusCode, 200);
    } finally {
      GroupChat.findOne = originals.gcFindOne;
      GroupChat.deleteMany = originals.gcDeleteMany;
      SeminarSeatRequest.find = originals.seatFindOpen;
    }
    assert.equal(offered.status, "expired");
    assert.equal(waitingRow.status, "expired");
    // Its money is released by the sweep, which needs the request left open.
    assert.equal(legacy.status, "pending");
  });
});

test("All is refused when the waitlist differs from what the host confirmed", async () => {
  const requests = [waiter(1), waiter(2), waiter(3)];
  await withStore([seminar()], requests, async (store) => {
    const stale = await admit({ all: true, expectedCount: 1 });
    assert.equal(stale.statusCode, 409);
    assert.deepEqual(store.capWrites, []);
    assert.deepEqual(statuses(requests), ["pending", "pending", "pending"]);
    const current = await admit({ all: true, expectedCount: 3 });
    assert.equal(current.statusCode, 200);
    assert.equal(current.body.admitted, 3);
  });
});

test("students holding offers can all pay at once", async () => {
  const claim = groupController.claimSeminarSeat;
  assert.equal(typeof claim, "function");
  const filters: any[] = [];
  const originals = {
    update: GroupChat.findOneAndUpdate,
    find: GroupChat.findById,
    count: SeminarSeatRequest.countDocuments,
  };
  try {
    GroupChat.findOneAndUpdate = async (filter: any) => { filters.push(filter); return {}; };
    GroupChat.findById = async () => seminar();
    // Two other offers are still open when this student pays.
    SeminarSeatRequest.countDocuments = async () => 2;
    await claim("sem-1", "waiter-1", 5, { holdsSeat: true });
    await claim("sem-1", "outsider-1", 5);
    assert.equal(filters[0].$expr.$lt[1], 5);
    // Someone without an offer still may not take a held seat.
    assert.equal(filters[1].$expr.$lt[1], 3);
  } finally {
    GroupChat.findOneAndUpdate = originals.update;
    GroupChat.findById = originals.find;
    SeminarSeatRequest.countDocuments = originals.count;
  }
});

test("an empty waitlist is refused without raising the cap", async () => {
  await withStore([seminar()], [], async (store) => {
    const res = await admit({ all: true });
    assert.equal(res.statusCode, 409);
    assert.deepEqual(store.capWrites, []);
  });
});

test("dismissing the waitlist banner only touches the host's own seminar, up to what they saw", async () => {
  const original = SeminarSeatRequest.updateMany;
  const calls: any[] = [];
  SeminarSeatRequest.updateMany = async (filter: any, update: any) => {
    calls.push({ filter, update });
    return {};
  };
  const dismiss = async (body: any) => {
    const res = createRes();
    await groupController.markWaitlistNoticeRead({ user: { userId: "host-1" }, body }, res);
    return res;
  };
  try {
    const through = "2026-11-05T12:00:00.000Z";
    const ok = await dismiss({ seminarId: "sem-1", through });
    assert.equal(ok.statusCode, 200);
    assert.equal(calls[0].filter.expert, "host-1");
    assert.equal(calls[0].filter.groupChat, "sem-1");
    assert.equal(calls[0].filter.status, "pending");
    assert.equal(calls[0].filter.createdAt.$lte.toISOString(), through);
    assert.ok(calls[0].update.$set.expertNoticeReadAt instanceof Date);

    for (const body of [{ through }, { seminarId: "sem-1" }, { seminarId: "sem-1", through: "soon" }, { seminarId: "sem-1", through: { $gt: "" } }]) {
      assert.equal((await dismiss(body)).statusCode, 400);
    }
    assert.equal(calls.length, 1);
  } finally {
    SeminarSeatRequest.updateMany = original;
  }
});
