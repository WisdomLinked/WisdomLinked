import test from "node:test";
import assert from "node:assert/strict";

const stripeController = require("../controllers/stripe.controller");
const notifications = require("../services/notifications");
const paymentController = require("../controllers/payment.controller");

type Stubs = {
  cancelIntent?: (pi: string) => any;
  succeeded?: () => any;
  authorized?: () => any;
  capture?: () => any;
  refund?: () => any;
};

let stubs: Stubs = {};
const calls: Record<string, any[]> = {};
const record = (name: string, args: any[]) => {
  calls[name] = calls[name] || [];
  calls[name].push(args);
};

stripeController.cancelPaymentIntent = async (pi: string) => {
  record("cancelIntent", [pi]);
  return stubs.cancelIntent ? stubs.cancelIntent(pi) : { status: "canceled" };
};
stripeController.checkPaymentIntentSucceeded = async () =>
  (stubs.succeeded ? stubs.succeeded() : false);
stripeController.checkPaymentIntentAuthorized = async () =>
  (stubs.authorized ? stubs.authorized() : false);
stripeController.capturePaymentIntent = async (pi: string) => {
  record("capture", [pi]);
  return stubs.capture ? stubs.capture() : false;
};
stripeController.refundPaymentIntent = async (pi: string) => {
  record("refund", [pi]);
  return stubs.refund ? stubs.refund() : { payment_intent: pi };
};
stripeController.sendBookingReceiptAndConfirmation = async () => {};
stripeController.listReconcilableBookingIntents = async () => [];

notifications.sendNotificationEmail = async (to: string, subject: string) => {
  record("email", [to, subject]);
};
notifications.sendEmailMeetingRequestToExpert = async () => {};
notifications.sendEmailMeetingRequestToCustomer = async () => {};
notifications.sendEmailMeetingAcceptance = async () => {};
notifications.scheduleEmailReminder = () => {};
paymentController.appendPaymentHistory = async (data: any) => {
  record("appendPaymentHistory", [data]);
  return true;
};

const groupController = require("../controllers/groupChat.controller");
const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const PaymentHistory = require("../models/PaymentHistory");
const SeminarSeatRequest = require("../models/SeminarSeatRequest");

const STUDENT_ID = "aaaaaaaaaaaaaaaaaaaaaaa1";
const EXPERT_ID = "bbbbbbbbbbbbbbbbbbbbbbb2";
const SEMINAR_ID = "ccccccccccccccccccccccc3";
const CHAT_ID = "ddddddddddddddddddddddd4";
const REQUEST_ID = "eeeeeeeeeeeeeeeeeeeeeee5";
const ROW_ID = "fffffffffffffffffffffff6";

const createRes = () => {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const seminarDoc = (overrides: any = {}) => ({
  _id: SEMINAR_ID,
  name: "Statistics Bootcamp",
  type: "seminar",
  status: "active",
  admin: EXPERT_ID,
  participants: [EXPERT_ID],
  start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  price: 100,
  maxAttendees: 1,
  ...overrides,
});

const seatRequestDoc = (overrides: any = {}) => ({
  _id: REQUEST_ID,
  customer: STUDENT_ID,
  expert: EXPERT_ID,
  groupChat: SEMINAR_ID,
  status: "pending",
  paymentIntent: "pi_held",
  paymentHistory: ROW_ID,
  stripeMode: "test",
  amount: 10000,
  currency: "usd",
  decisionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
  ...overrides,
});

const heldSessionDoc = (overrides: any = {}) => ({
  _id: CHAT_ID,
  name: "PhD Application Advice",
  type: "individual",
  status: "pending",
  admin: EXPERT_ID,
  createdBy: STUDENT_ID,
  participants: [STUDENT_ID, EXPERT_ID],
  decisionDeadline: new Date(Date.now() - 60 * 1000),
  ...overrides,
});

const parkedRowDoc = (overrides: any = {}) => ({
  _id: ROW_ID,
  paymentType: "charge",
  status: "withheld",
  paymentIntent: "pi_held",
  amount: 10000,
  currency: "usd",
  stripeMode: "test",
  customer: STUDENT_ID,
  expert: EXPERT_ID,
  groupChat: CHAT_ID,
  ...overrides,
});

const chainable = (result: any) => {
  const box: any = {
    select: () => box,
    populate: () => box,
    sort: () => box,
    limit: () => box,
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(result).catch(reject),
    finally: (fn: any) => Promise.resolve(result).finally(fn),
  };
  return box;
};

const withModels = ({
  seminar,
  request,
  sessions = [],
  parked = null,
  dueRequests = [],
  claimWins = true,
}: any = {}) => {
  const original = {
    groupFindById: GroupChat.findById,
    groupFind: GroupChat.find,
    groupFindOneAndUpdate: GroupChat.findOneAndUpdate,
    groupUpdateOne: GroupChat.updateOne,
    groupExists: GroupChat.exists,
    userFindById: User.findById,
    userUpdateOne: User.updateOne,
    historyFindOne: PaymentHistory.findOne,
    historyFindByIdAndUpdate: PaymentHistory.findByIdAndUpdate,
    historyExists: PaymentHistory.exists,
    seatFindById: SeminarSeatRequest.findById,
    seatFind: SeminarSeatRequest.find,
    seatFindOneAndUpdate: SeminarSeatRequest.findOneAndUpdate,
    seatUpdateOne: SeminarSeatRequest.updateOne,
    seatExists: SeminarSeatRequest.exists,
  };

  GroupChat.findById = (id: any) => chainable(
    String(id) === SEMINAR_ID ? seminar : sessions.find((s: any) => String(s._id) === String(id)) || null,
  );
  GroupChat.find = (filter: any) => chainable(
    filter?.type === "individual" ? sessions : [],
  );
  GroupChat.findOneAndUpdate = async (filter: any, update: any) => {
    record("groupClaim", [filter, update]);
    if (!claimWins) return null;
    return sessions.find((s: any) => String(s._id) === String(filter?._id)) || seminar || {};
  };
  GroupChat.updateOne = async (filter: any, update: any) => {
    record("groupUpdateOne", [filter, update]);
    return { modifiedCount: 1 };
  };
  GroupChat.exists = async () => null;

  User.findById = (id: any) => chainable({
    _id: String(id),
    email: String(id) === EXPERT_ID ? "expert@test.com" : "student@test.com",
    username: String(id) === EXPERT_ID ? "Expert" : "Student",
  });
  User.updateOne = async () => ({ modifiedCount: 1 });

  PaymentHistory.findOne = (filter: any) => {
    record("historyFindOne", [filter]);
    return chainable(filter?.status === "withheld" ? parked : null);
  };
  PaymentHistory.findByIdAndUpdate = (id: any, update: any) => {
    record("historyUpdate", [String(id), update]);
    return chainable({ _id: id });
  };
  PaymentHistory.exists = async () => null;

  SeminarSeatRequest.findById = (id: any) => chainable(request || null);
  SeminarSeatRequest.find = () => chainable(dueRequests);
  SeminarSeatRequest.findOneAndUpdate = async (filter: any, update: any) => {
    record("seatClaim", [filter, update]);
    return claimWins ? request || {} : null;
  };
  SeminarSeatRequest.updateOne = async (filter: any, update: any) => {
    record("seatUpdateOne", [filter, update]);
    return { modifiedCount: 1 };
  };
  SeminarSeatRequest.exists = async () => null;

  return () => Object.assign(GroupChat, {
    findById: original.groupFindById,
    find: original.groupFind,
    findOneAndUpdate: original.groupFindOneAndUpdate,
    updateOne: original.groupUpdateOne,
    exists: original.groupExists,
  }) && Object.assign(User, {
    findById: original.userFindById,
    updateOne: original.userUpdateOne,
  }) && Object.assign(PaymentHistory, {
    findOne: original.historyFindOne,
    findByIdAndUpdate: original.historyFindByIdAndUpdate,
    exists: original.historyExists,
  }) && Object.assign(SeminarSeatRequest, {
    findById: original.seatFindById,
    find: original.seatFind,
    findOneAndUpdate: original.seatFindOneAndUpdate,
    updateOne: original.seatUpdateOne,
    exists: original.seatExists,
  });
};

const resetCalls = () => {
  stubs = {};
  for (const key of Object.keys(calls)) delete calls[key];
};

const DECLINE_NOTE = "The room is full — try the October cohort.";

const rowUpdate = () => calls.historyUpdate?.[0]?.[1];

test("declining a seat request marks the hold released, not refunded", async () => {
  resetCalls();
  const restore = withModels({ seminar: seminarDoc(), request: seatRequestDoc() });
  try {
    const res = createRes();
    await groupController.rejectSeminarSeatRequest(
      { user: { userId: EXPERT_ID }, body: { requestId: REQUEST_ID, note: DECLINE_NOTE } },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(calls.cancelIntent?.length, 1, "the hold is cancelled");
    assert.equal(calls.refund, undefined, "money never taken is never refunded");
    assert.equal(rowUpdate()?.status, "released");
    assert.match(String(rowUpdate()?.description), /Hold released/i);
  } finally {
    restore();
  }
});

test("a seat request hold that was already captured settles as refunded", async () => {
  resetCalls();
  const restore = withModels({ seminar: seminarDoc(), request: seatRequestDoc() });
  try {
    stubs.cancelIntent = () => false;
    stubs.succeeded = () => ({ status: "succeeded" });

    const res = createRes();
    await groupController.rejectSeminarSeatRequest(
      { user: { userId: EXPERT_ID }, body: { requestId: REQUEST_ID, note: DECLINE_NOTE } },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(calls.refund?.length, 1);
    assert.equal(rowUpdate()?.status, "refunded", "a real refund is not called a release");
  } finally {
    restore();
  }
});

test("a seat request hold that will not release is flagged for a human", async () => {
  resetCalls();
  const restore = withModels({ seminar: seminarDoc(), request: seatRequestDoc() });
  try {
    stubs.cancelIntent = () => false;
    stubs.succeeded = () => false;
    stubs.authorized = () => ({ status: "requires_capture" });

    const res = createRes();
    await groupController.rejectSeminarSeatRequest(
      { user: { userId: EXPERT_ID }, body: { requestId: REQUEST_ID, note: DECLINE_NOTE } },
      res,
    );

    assert.equal(rowUpdate()?.status, "pending", "stuck money stays actionable");
    assert.match(String(rowUpdate()?.description), /ACTION REQUIRED/);
  } finally {
    restore();
  }
});

test("a free seat request has no hold to release", async () => {
  resetCalls();
  const restore = withModels({
    seminar: seminarDoc({ price: 0 }),
    request: seatRequestDoc({ paymentIntent: undefined, paymentHistory: undefined, amount: 0 }),
  });
  try {
    const res = createRes();
    await groupController.rejectSeminarSeatRequest(
      { user: { userId: EXPERT_ID }, body: { requestId: REQUEST_ID, note: DECLINE_NOTE } },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(calls.cancelIntent, undefined);
    assert.equal(calls.historyUpdate, undefined, "there is no payment row to settle");
  } finally {
    restore();
  }
});

test("an expired seat request releases the hold on the sweep", async () => {
  resetCalls();
  const request = seatRequestDoc({
    decisionDeadline: new Date(Date.now() - 1000),
    groupChat: { _id: SEMINAR_ID, name: "Statistics Bootcamp" },
  });
  const restore = withModels({ seminar: seminarDoc(), request, dueRequests: [request] });
  try {
    const expired = await groupController.sweepExpiredSeatRequests();

    assert.equal(expired, 1);
    assert.equal(calls.seatClaim?.[0]?.[1]?.$set?.status, "expired");
    assert.equal(calls.cancelIntent?.length, 1);
    assert.equal(rowUpdate()?.status, "released");
  } finally {
    restore();
  }
});

test("a lapsed 1:1 hold is released and its request cancelled", async () => {
  resetCalls();
  const chat = heldSessionDoc();
  const restore = withModels({ sessions: [chat], parked: parkedRowDoc() });
  try {
    const expired = await groupController.sweepExpiredSessionHolds();

    assert.equal(expired, 1);
    assert.equal(calls.groupClaim?.[0]?.[1]?.$set?.status, "cancelled");
    assert.equal(calls.cancelIntent?.[0]?.[0], "pi_held");
    assert.equal(calls.refund, undefined);
    assert.equal(rowUpdate()?.status, "released");

    const sent = (calls.email || []).find((c: any[]) => /expired/i.test(String(c[1])));
    assert.ok(sent, "the student is told the request expired");
    assert.equal(sent[0], "student@test.com");
  } finally {
    restore();
  }
});

test("a lapsed 1:1 hold already captured is refunded instead", async () => {
  resetCalls();
  const restore = withModels({ sessions: [heldSessionDoc()], parked: parkedRowDoc() });
  try {
    stubs.cancelIntent = () => false;
    stubs.succeeded = () => ({ status: "succeeded" });

    await groupController.sweepExpiredSessionHolds();

    assert.equal(calls.refund?.length, 1);
    assert.equal(calls.appendPaymentHistory?.[0]?.[0]?.paymentType, "refund");
    assert.equal(rowUpdate()?.status, "refunded");
  } finally {
    restore();
  }
});

test("a lapsed 1:1 hold that will not settle is flagged for a human", async () => {
  resetCalls();
  const restore = withModels({ sessions: [heldSessionDoc()], parked: parkedRowDoc() });
  try {
    stubs.cancelIntent = () => false;
    stubs.succeeded = () => false;
    stubs.authorized = () => ({ status: "requires_capture" });

    await groupController.sweepExpiredSessionHolds();

    assert.equal(rowUpdate()?.status, "pending");
    assert.match(String(rowUpdate()?.description), /ACTION REQUIRED/);
  } finally {
    restore();
  }
});

test("a pending 1:1 with no hold is left alone by the sweep", async () => {
  resetCalls();
  const restore = withModels({ sessions: [heldSessionDoc()], parked: null });
  try {
    const expired = await groupController.sweepExpiredSessionHolds();

    assert.equal(expired, 0, "a free session is not cancelled for lack of money");
    assert.equal(calls.groupClaim, undefined, "its status is never claimed");
    assert.equal(calls.cancelIntent, undefined);
  } finally {
    restore();
  }
});

test("the sweep does not touch a session another request already decided", async () => {
  resetCalls();
  const restore = withModels({
    sessions: [heldSessionDoc()],
    parked: parkedRowDoc(),
    claimWins: false,
  });
  try {
    const expired = await groupController.sweepExpiredSessionHolds();

    assert.equal(expired, 0);
    assert.equal(calls.cancelIntent, undefined, "the other decision owns the money");
  } finally {
    restore();
  }
});
