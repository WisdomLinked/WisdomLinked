import test from "node:test";
import assert from "node:assert/strict";

// groupChat.controller destructures these at require time, so the dispatchers have to
// be installed before it loads; per-test behaviour is swapped through `stubs`.
const stripeController = require("../controllers/stripe.controller");
const notifications = require("../services/notifications");
const paymentController = require("../controllers/payment.controller");

type Stubs = {
  authorized?: (pi: string, mode: string) => any;
  succeeded?: (pi: string, mode: string) => any;
  capture?: (pi: string, mode: string, amount?: number) => any;
  cancel?: (pi: string, mode: string) => any;
  refund?: (pi: string, amount: any, mode: string) => any;
};

let stubs: Stubs = {};
const calls: Record<string, any[]> = {};
const record = (name: string, args: any[]) => {
  calls[name] = calls[name] || [];
  calls[name].push(args);
};

stripeController.checkPaymentIntentAuthorized = async (pi: string, mode: string) => {
  record("authorized", [pi, mode]);
  return stubs.authorized ? stubs.authorized(pi, mode) : false;
};
stripeController.checkPaymentIntentProcessing = async () => false;
stripeController.readPaymentIntent = async () => null;
stripeController.checkPaymentIntentSucceeded = async (pi: string, mode: string) => {
  record("succeeded", [pi, mode]);
  return stubs.succeeded ? stubs.succeeded(pi, mode) : false;
};
stripeController.capturePaymentIntent = async (pi: string, mode: string, amount?: number) => {
  record("capture", [pi, mode, amount]);
  return stubs.capture ? stubs.capture(pi, mode, amount) : false;
};
stripeController.cancelPaymentIntent = async (pi: string, mode: string) => {
  record("cancel", [pi, mode]);
  return stubs.cancel ? stubs.cancel(pi, mode) : { status: "canceled" };
};
stripeController.refundPaymentIntent = async (pi: string, amount: any, mode: string) => {
  record("refund", [pi, amount, mode]);
  return stubs.refund ? stubs.refund(pi, amount, mode) : { payment_intent: pi };
};
stripeController.sendBookingReceiptAndConfirmation = async () => {};
let reconcilableIntents: any[] = [];
stripeController.listReconcilableBookingIntents = async () => reconcilableIntents;

notifications.sendEmailMeetingRequestToExpert = async () => {};
notifications.sendEmailMeetingRequestToCustomer = async () => {};
notifications.sendEmailSessionPaidToExpert = async () => {};
notifications.sendEmailMeetingAcceptance = async () => {};
notifications.sendNotificationEmail = async (to: string, subject: string) => {
  record("email", [to, subject]);
};
notifications.sendSessionReminderEmail = async () => {};
paymentController.appendPaymentHistory = async (data: any) => {
  record("appendPaymentHistory", [data]);
  return true;
};

const groupController = require("../controllers/groupChat.controller");
const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const Event = require("../models/Event");
const AppState = require("../models/AppState");
const PaymentHistory = require("../models/PaymentHistory");

const STUDENT_ID = "aaaaaaaaaaaaaaaaaaaaaaa1";
const EXPERT_ID = "bbbbbbbbbbbbbbbbbbbbbbb2";
const OTHER_ID = "ccccccccccccccccccccccc3";
const CHAT_ID = "ddddddddddddddddddddddd4";

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

const futureUtcDate = (daysFromNow: number, hourUtc: number) => {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date;
};

const bookingStart = futureUtcDate(14, 9);
const bookingEnd = new Date(bookingStart.getTime() + 60 * 60 * 1000);

// $100/hr for 60 minutes = 10000 cents.
const EXPECTED_CENTS = 10000;

const expertDoc = () => ({
  _id: EXPERT_ID,
  email: "expert@test.com",
  username: "Expert",
  price: [100],
  bufferMinutes: 0,
  bookingNoticeHours: 24,
  // Half-hour slot indices (hour * 2): 09:00–10:00 UTC needs 18 and 19.
  timeSlots: [18, 19, 20],
  timeZone: "UTC",
  blockedBookingDates: [],
  blockedBookingSlots: [],
  groupChats: [] as any[],
  save: async () => {},
  populate: () => {},
});

const studentDoc = () => ({
  _id: STUDENT_ID,
  email: "student@test.com",
  username: "Student",
  timeZone: "UTC",
  groupChats: [] as any[],
  save: async () => {},
  populate: () => {},
});

const oneToOneBody = {
  name: "PhD Application Advice",
  description: "",
  services: [],
  keywords: [],
  start: bookingStart.toISOString(),
  end: bookingEnd.toISOString(),
  duration: 60,
  expert: EXPERT_ID,
  payment_intent: "pi_booking",
};

const heldIntent = (overrides: any = {}) => {
  const { metadata, ...rest } = overrides;
  return {
    amount: EXPECTED_CENTS,
    currency: "usd",
    latest_charge: null,
    ...rest,
    metadata: {
      bookingType: "oneToOne",
      expertId: EXPERT_ID,
      userId: STUDENT_ID,
      ...(metadata || {}),
    },
  };
};

/** Installs the model stubs every 1:1 booking needs; returns a restore function. */
const withOneToOneModels = () => {
  const original = {
    userFindById: User.findById,
    groupCreate: GroupChat.create,
    groupFind: GroupChat.find,
    groupFindOneAndUpdate: GroupChat.findOneAndUpdate,
    groupDeleteOne: GroupChat.deleteOne,
    groupUpdateOne: GroupChat.updateOne,
    userUpdateOne: User.updateOne,
    eventFind: Event.find,
    appStateFindOne: AppState.findOne,
    historyFind: PaymentHistory.find,
    historyExists: PaymentHistory.exists,
    historyFindByIdAndUpdate: PaymentHistory.findByIdAndUpdate,
    historyFindByIdAndDelete: PaymentHistory.findByIdAndDelete,
    historySave: PaymentHistory.prototype.save,
  };

  User.findById = async (id: any) =>
    String(id) === EXPERT_ID ? expertDoc() : studentDoc();
  GroupChat.create = async (doc: any) => {
    record("groupCreate", [doc]);
    return { ...doc, _id: CHAT_ID };
  };
  GroupChat.find = () => ({ select: async () => [] });
  GroupChat.findOneAndUpdate = async (filter: any, update: any) => {
    record("groupFindOneAndUpdate", [filter, update]);
    return { _id: CHAT_ID };
  };
  GroupChat.deleteOne = async (filter: any) => {
    record("groupDeleteOne", [filter]);
    return { deletedCount: 1 };
  };
  GroupChat.updateOne = async (filter: any, update: any) => {
    record("groupUpdateOne", [filter, update]);
    return { modifiedCount: 1 };
  };
  User.updateOne = async (filter: any, update: any) => {
    record("userUpdateOne", [filter, update]);
    return { modifiedCount: 1 };
  };
  Event.find = () => ({ select: async () => [] });
  AppState.findOne = async () => ({ stripeMode: "test" });
  PaymentHistory.find = () => ({ select: async () => [] });
  PaymentHistory.exists = async () => null;
  PaymentHistory.findByIdAndUpdate = async (id: any, update: any) => {
    record("historyUpdate", [id, update]);
    return {};
  };
  PaymentHistory.findByIdAndDelete = async (id: any) => {
    record("historyDelete", [id]);
    return {};
  };
  PaymentHistory.prototype.save = async function (this: any) {
    record("historySave", [{ status: this.status, paymentIntent: this.paymentIntent }]);
    return this;
  };

  return () => {
    User.findById = original.userFindById;
    GroupChat.create = original.groupCreate;
    GroupChat.find = original.groupFind;
    GroupChat.findOneAndUpdate = original.groupFindOneAndUpdate;
    GroupChat.deleteOne = original.groupDeleteOne;
    GroupChat.updateOne = original.groupUpdateOne;
    User.updateOne = original.userUpdateOne;
    Event.find = original.eventFind;
    AppState.findOne = original.appStateFindOne;
    PaymentHistory.find = original.historyFind;
    PaymentHistory.exists = original.historyExists;
    PaymentHistory.findByIdAndUpdate = original.historyFindByIdAndUpdate;
    PaymentHistory.findByIdAndDelete = original.historyFindByIdAndDelete;
    PaymentHistory.prototype.save = original.historySave;
  };
};

const resetCalls = () => {
  stubs = {};
  reconcilableIntents = [];
  for (const key of Object.keys(calls)) delete calls[key];
};

test("1:1 booking is refused when the intent is neither authorized nor captured", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  try {
    stubs.authorized = () => false;
    stubs.succeeded = () => false;

    const req: any = { user: { userId: STUDENT_ID }, body: oneToOneBody };
    const res = createRes();
    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body), /could not be verified/i);
    assert.equal(calls.groupCreate, undefined, "no session may be created");
    assert.equal(calls.capture, undefined, "nothing may be captured");
  } finally {
    restore();
  }
});

test("1:1 booking with an expert who has not finished profile setup is refused and the hold released", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  try {
    stubs.authorized = () => heldIntent();
    User.findById = async (id: any) =>
      String(id) === EXPERT_ID ? { ...expertDoc(), bufferMinutes: undefined } : studentDoc();

    const req: any = { user: { userId: STUDENT_ID }, body: oneToOneBody };
    const res = createRes();
    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /hasn't completed their profile setup/);
    assert.equal(calls.groupCreate, undefined, "no session may be created");
    assert.equal(calls.capture, undefined, "nothing may be captured");
    assert.equal(calls.cancel?.length, 1, "the student's hold must be released");
  } finally {
    restore();
  }
});

test("1:1 booking is refused when the hold belongs to another account, and that hold is left alone", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  try {
    stubs.authorized = () => heldIntent({ metadata: { userId: OTHER_ID } });

    const req: any = { user: { userId: STUDENT_ID }, body: oneToOneBody };
    const res = createRes();
    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body), /does not belong to this booking/i);
    assert.equal(calls.groupCreate, undefined, "no session may be created");
    // The intent names someone else, so we must not cancel it on their behalf.
    assert.equal(calls.cancel, undefined);
  } finally {
    restore();
  }
});

test("1:1 booking is refused when the hold is for a different expert", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  try {
    stubs.authorized = () => heldIntent({ metadata: { expertId: OTHER_ID } });

    const req: any = { user: { userId: STUDENT_ID }, body: oneToOneBody };
    const res = createRes();
    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(calls.groupCreate, undefined, "no session may be created");
    // Same payer, wrong booking — the hold is ours to release.
    assert.equal(calls.cancel?.length, 1);
  } finally {
    restore();
  }
});

test("1:1 booking is refused and the hold released when the amount does not match", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  try {
    stubs.authorized = () => heldIntent({ amount: 100 });

    const req: any = { user: { userId: STUDENT_ID }, body: oneToOneBody };
    const res = createRes();
    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(calls.groupCreate, undefined, "no session may be created");
    assert.equal(calls.cancel?.length, 1, "the underpaying hold must be released");
  } finally {
    restore();
  }
});

test("1:1 booking keeps a hold authorized at a previous fee-inclusive total", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  try {
    // Advertised $100. This hold was authorized at $111.24 (fee + 8% tax).
    // Today's default rates charge $103.00. The older authorization still settles.
    stubs.authorized = () => heldIntent({
      amount: 11124,
      metadata: {
        sessionType: "oneToOne",
        advertisedCents: "10000",
        platformFeeCents: "300",
        taxCents: "824",
        commissionCents: "2000",
        expertNetCents: "8000",
        expertCommissionPercent: "20",
        studentFeePercent: "3",
        studentFeeCapDollars: "5",
        taxPercent: "8",
        freeSessionPlatformFeeDollars: "1",
      },
    });

    const req: any = { user: { userId: STUDENT_ID }, body: oneToOneBody };
    const res = createRes();
    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(calls.groupCreate?.length, 1, "the session is created from the existing authorization");
    assert.equal(calls.cancel, undefined, "the previous-rate hold is not released");
    assert.equal(calls.historySave?.[0]?.[0]?.status, "withheld");
  } finally {
    restore();
  }
});

test("1:1 booking holds the money and never captures at request time", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  try {
    stubs.authorized = () => heldIntent();

    const req: any = { user: { userId: STUDENT_ID }, body: oneToOneBody };
    const res = createRes();
    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(calls.groupCreate?.length, 1);
    assert.equal(calls.capture, undefined, "the expert has not agreed yet, so nothing is captured");
    assert.equal(calls.cancel, undefined, "the hold stays live");
    assert.equal(calls.historySave?.[0]?.[0]?.status, "withheld");
    assert.equal(res.body?.paymentState, "withheld");
  } finally {
    restore();
  }
});

test("1:1 booking stamps a decision deadline inside the authorization window", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  const captureBeforeSec = Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000);
  try {
    stubs.authorized = () =>
      heldIntent({
        latest_charge: { payment_method_details: { card: { capture_before: captureBeforeSec } } },
      });

    const req: any = { user: { userId: STUDENT_ID }, body: oneToOneBody };
    const res = createRes();
    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 200);
    const stamped = calls.groupUpdateOne?.find((c: any[]) => c[1]?.$set?.decisionDeadline);
    assert.ok(stamped, "the session carries a decision deadline");

    const deadline = new Date(stamped[1].$set.decisionDeadline).getTime();
    assert.ok(deadline < captureBeforeSec * 1000, "the deadline lands before Stripe's own expiry");
    assert.ok(deadline > Date.now(), "and in the future");
  } finally {
    restore();
  }
});

test("1:1 booking rolls the session back when the hold cannot be recorded", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  try {
    stubs.authorized = () => heldIntent();
    stubs.cancel = () => ({ status: "canceled" });
    PaymentHistory.prototype.save = async function () {
      throw new Error("history write failed");
    };

    const req: any = { user: { userId: STUDENT_ID }, body: oneToOneBody };
    const res = createRes();
    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(calls.groupDeleteOne?.length, 1, "the unbacked session must be removed");
    assert.equal(calls.cancel?.length, 1, "the hold must be released");
  } finally {
    restore();
  }
});

test("an expert with a $0 rate has not finished setup, so cannot be booked", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  try {
    User.findById = async (id: any) =>
      String(id) === EXPERT_ID ? { ...expertDoc(), price: [0] } : studentDoc();

    const req: any = {
      user: { userId: STUDENT_ID },
      body: { ...oneToOneBody, payment_intent: undefined },
    };
    const res = createRes();
    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(calls.groupCreate, undefined);
    assert.equal(calls.capture, undefined);
  } finally {
    restore();
  }
});

test("double-submit: the request that loses the charge-row race rolls back and keeps its hands off the hold", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  try {
    stubs.authorized = () => heldIntent();
    // The unique index on PaymentHistory.paymentIntent rejects the second claim.
    PaymentHistory.prototype.save = async function (this: any) {
      const err: any = new Error("E11000 duplicate key error");
      err.code = 11000;
      throw err;
    };

    const req: any = { user: { userId: STUDENT_ID }, body: oneToOneBody };
    const res = createRes();
    await groupController.createGroupChatByUser(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /already been used/i);
    assert.equal(calls.groupDeleteOne?.length, 1, "the duplicate session must be rolled back");
    assert.equal(calls.capture, undefined, "the loser must not capture");
    assert.equal(calls.cancel, undefined, "the winner's hold must not be cancelled");
  } finally {
    restore();
  }
});

test("accepting a proposed 1:1 is refused for someone who is not on the session", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  const originalFindOne = GroupChat.findOne;
  try {
    let saved = false;
    GroupChat.findOne = async () => ({
      _id: CHAT_ID,
      name: "Proposed session",
      price: 100,
      status: "pending",
      admin: EXPERT_ID,
      createdBy: EXPERT_ID,
      participants: [OTHER_ID, EXPERT_ID],
      save: async () => {
        saved = true;
      },
    });

    const req: any = {
      user: { userId: STUDENT_ID, role: "customer" },
      body: { groupChatId: CHAT_ID, payment_intent: "pi_booking" },
    };
    const res = createRes();
    await groupController.acceptIndividualAppointment(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(String(res.body), /not yours to accept/i);
    assert.equal(saved, false, "the session must not be activated");
    assert.equal(calls.capture, undefined);
  } finally {
    GroupChat.findOne = originalFindOne;
    restore();
  }
});

test("accepting a proposed 1:1 reverts the session to pending when the capture fails", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  const originalFindOne = GroupChat.findOne;
  try {
    const chat: any = {
      _id: CHAT_ID,
      name: "Proposed session",
      price: 100,
      status: "pending",
      admin: EXPERT_ID,
      createdBy: EXPERT_ID,
      participants: [STUDENT_ID, EXPERT_ID],
      save: async function () {
        record("chatSave", [this.status]);
        return this;
      },
    };
    GroupChat.findOne = async () => chat;
    stubs.authorized = () =>
      heldIntent({ metadata: { bookingType: "groupChat", groupChatId: CHAT_ID, expertId: undefined } });
    stubs.capture = () => false;
    stubs.succeeded = () => false;

    const req: any = {
      user: { userId: STUDENT_ID, role: "customer" },
      body: { groupChatId: CHAT_ID, payment_intent: "pi_booking" },
    };
    const res = createRes();
    await groupController.acceptIndividualAppointment(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(chat.status, "pending", "an uncaptured session must not stay active");
    assert.equal(calls.cancel?.length, 1, "the hold must be released");
  } finally {
    GroupChat.findOne = originalFindOne;
    restore();
  }
});

test("seminar registration is refused when the hold belongs to another account", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  const originalFindOne = GroupChat.findOne;
  const originalFindOneAndUpdate = GroupChat.findOneAndUpdate;
  try {
    GroupChat.findOne = async () => ({
      _id: CHAT_ID,
      name: "Seminar",
      type: "seminar",
      price: 100,
      status: "active",
      admin: EXPERT_ID,
      participants: [EXPERT_ID],
      start: bookingStart,
      duration: 60,
    });
    GroupChat.findOneAndUpdate = async (...args: any[]) => {
      record("claimSeat", args);
      return null;
    };
    stubs.authorized = () =>
      heldIntent({ metadata: { bookingType: "groupChat", groupChatId: CHAT_ID, userId: OTHER_ID, expertId: undefined } });

    const req: any = {
      user: { userId: STUDENT_ID },
      body: { groupChatId: CHAT_ID, payment_intent: "pi_booking" },
    };
    const res = createRes();
    await groupController.registerForSeminar(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body), /does not belong to this booking/i);
    assert.equal(calls.claimSeat, undefined, "no seat may be claimed");
    assert.equal(calls.capture, undefined);
  } finally {
    GroupChat.findOne = originalFindOne;
    GroupChat.findOneAndUpdate = originalFindOneAndUpdate;
    restore();
  }
});

test("orphan recovery matches a 1:1 on the advertised price, not the charged total", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  const SeminarSeatRequest = require("../models/SeminarSeatRequest");
  const originalExists = GroupChat.exists;
  const originalSeatExists = SeminarSeatRequest.exists;
  try {
    GroupChat.exists = async (filter: any) => {
      record("groupExists", [filter]);
      return filter?.price === 100 ? { _id: CHAT_ID } : null;
    };
    SeminarSeatRequest.exists = async () => null;
    reconcilableIntents = [{
      id: "pi_orphan",
      status: "succeeded",
      amount: 10300,
      currency: "usd",
      createdMs: Date.now() - 2 * 60 * 60 * 1000,
      metadata: {
        bookingType: "oneToOne",
        userId: STUDENT_ID,
        expertId: EXPERT_ID,
        sessionType: "oneToOne",
        advertisedCents: "10000",
        platformFeeCents: "300",
        taxCents: "0",
        commissionCents: "2000",
        expertNetCents: "8000",
        expertCommissionPercent: "20",
        studentFeePercent: "3",
        studentFeeCapDollars: "5",
        taxPercent: "0",
        freeSessionPlatformFeeDollars: "1",
      },
    }];

    await groupController.sweepOrphanedBookingIntents();

    const query = calls.groupExists?.[0]?.[0];
    const row = calls.appendPaymentHistory?.[0]?.[0];
    assert.equal(query?.price, 100, "the lookup uses the advertised dollars");
    assert.notEqual(query?.price, 103);
    assert.equal(calls.refund, undefined, "a paid booking is not refunded for the fee");
    assert.equal(row?.amount, 10300);
    assert.equal(row?.advertisedCents, 10000);
    assert.equal(row?.expertNetCents, 8000);
  } finally {
    GroupChat.exists = originalExists;
    SeminarSeatRequest.exists = originalSeatExists;
    restore();
  }
});

const seminarDoc = () => ({
  _id: CHAT_ID,
  name: "test booking",
  type: "seminar",
  price: 100,
  status: "active",
  admin: EXPERT_ID,
  participants: [EXPERT_ID],
  start: bookingStart,
  duration: 30,
});

const succeededWalletIntent = () => ({
  id: "pi_booking",
  status: "succeeded",
  amount: EXPECTED_CENTS,
  currency: "usd",
  latest_charge: { id: "ch_wallet", balance_transaction: "txn_wallet" },
  metadata: {
    bookingType: "groupChat",
    groupChatId: CHAT_ID,
    userId: STUDENT_ID,
  },
});

test("seminar WeChat registration waits out a succeeded redirect that has not settled yet", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  const SeminarSeatRequest = require("../models/SeminarSeatRequest");
  const originalFindOne = GroupChat.findOne;
  const originalFind = GroupChat.find;
  const originalFindById = GroupChat.findById;
  const originalUpdateMany = GroupChat.updateMany;
  const originalUserFindOne = User.findOne;
  const originalHistoryFindOne = PaymentHistory.findOne;
  const originalCount = SeminarSeatRequest.countDocuments;
  const originalRead = stripeController.readPaymentIntent;
  const previousPolls = process.env.BOOKING_SETTLE_POLLS;
  const previousPollMs = process.env.BOOKING_SETTLE_POLL_MS;
  process.env.BOOKING_SETTLE_POLLS = "4";
  process.env.BOOKING_SETTLE_POLL_MS = "0";
  try {
    GroupChat.findOne = async () => seminarDoc();
    GroupChat.find = async () => [];
    GroupChat.findById = () => ({ populate: () => ({ populate: async () => null }) });
    GroupChat.updateMany = async () => ({ modifiedCount: 1 });
    PaymentHistory.findOne = async () => null;
    User.findOne = () => ({
      select() { return this; },
      populate() { return Promise.resolve(studentDoc()); },
    });
    SeminarSeatRequest.countDocuments = async () => 0;
    let reads = 0;
    stripeController.readPaymentIntent = async () => {
      reads += 1;
      return reads < 2
        ? { status: "requires_action" }
        : { status: "succeeded" };
    };
    let succeededReads = 0;
    stubs.succeeded = () => {
      succeededReads += 1;
      return succeededReads < 2 ? false : succeededWalletIntent();
    };

    const req: any = {
      user: { userId: STUDENT_ID },
      body: { groupChatId: CHAT_ID, payment_intent: "pi_booking" },
    };
    const res = createRes();
    await groupController.registerForSeminar(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.success, true);
    assert.equal(calls.refund, undefined);
    const subjects = (calls.email || []).map((args: any[]) => String(args[1]));
    assert.equal(subjects.some((subject) => /couldn't complete your booking/i.test(subject)), false);
    assert.ok(reads >= 1);
  } finally {
    GroupChat.findOne = originalFindOne;
    GroupChat.find = originalFind;
    GroupChat.findById = originalFindById;
    GroupChat.updateMany = originalUpdateMany;
    User.findOne = originalUserFindOne;
    PaymentHistory.findOne = originalHistoryFindOne;
    SeminarSeatRequest.countDocuments = originalCount;
    stripeController.readPaymentIntent = originalRead;
    if (previousPolls === undefined) delete process.env.BOOKING_SETTLE_POLLS;
    else process.env.BOOKING_SETTLE_POLLS = previousPolls;
    if (previousPollMs === undefined) delete process.env.BOOKING_SETTLE_POLL_MS;
    else process.env.BOOKING_SETTLE_POLL_MS = previousPollMs;
    restore();
  }
});

test("a WeChat provider decline fails seminar registration immediately and emails the student", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  const originalFindOne = GroupChat.findOne;
  const originalRead = stripeController.readPaymentIntent;
  const previousPolls = process.env.BOOKING_SETTLE_POLLS;
  const previousPollMs = process.env.BOOKING_SETTLE_POLL_MS;
  process.env.BOOKING_SETTLE_POLLS = "4";
  process.env.BOOKING_SETTLE_POLL_MS = "0";
  try {
    GroupChat.findOne = async () => seminarDoc();
    let reads = 0;
    stripeController.readPaymentIntent = async () => {
      reads += 1;
      return {
        status: "requires_payment_method",
        last_payment_error: { decline_code: "partner_generic_decline" },
      };
    };
    stubs.succeeded = () => false;

    const req: any = {
      user: { userId: STUDENT_ID },
      body: { groupChatId: CHAT_ID, payment_intent: "pi_booking" },
    };
    const res = createRes();
    await groupController.registerForSeminar(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(reads, 1);
    const subjects = (calls.email || []).map((args: any[]) => String(args[1]));
    assert.equal(subjects.some((subject) => /couldn't complete your booking/i.test(subject)), true);
  } finally {
    GroupChat.findOne = originalFindOne;
    stripeController.readPaymentIntent = originalRead;
    if (previousPolls === undefined) delete process.env.BOOKING_SETTLE_POLLS;
    else process.env.BOOKING_SETTLE_POLLS = previousPolls;
    if (previousPollMs === undefined) delete process.env.BOOKING_SETTLE_POLL_MS;
    else process.env.BOOKING_SETTLE_POLL_MS = previousPollMs;
    restore();
  }
});

test("a second seminar register for the same succeeded WeChat payment does not refund it", async () => {
  resetCalls();
  const restore = withOneToOneModels();
  const SeminarSeatRequest = require("../models/SeminarSeatRequest");
  const originalFindOne = GroupChat.findOne;
  const originalFindById = GroupChat.findById;
  const originalCount = SeminarSeatRequest.countDocuments;
  const originalExists = PaymentHistory.exists;
  try {
    const enrolled = {
      ...seminarDoc(),
      participants: [EXPERT_ID, STUDENT_ID],
    };
    GroupChat.findOne = async () => enrolled;
    GroupChat.findOneAndUpdate = async () => null;
    GroupChat.findById = async () => enrolled;
    SeminarSeatRequest.countDocuments = async () => 0;
    PaymentHistory.exists = async (query: any) => query?.paymentIntent === "pi_booking";
    stubs.succeeded = () => succeededWalletIntent();

    const req: any = {
      user: { userId: STUDENT_ID },
      body: { groupChatId: CHAT_ID, payment_intent: "pi_booking" },
    };
    const res = createRes();
    await groupController.registerForSeminar(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.alreadyRegistered, true);
    assert.equal(calls.refund, undefined);
  } finally {
    GroupChat.findOne = originalFindOne;
    GroupChat.findById = originalFindById;
    SeminarSeatRequest.countDocuments = originalCount;
    PaymentHistory.exists = originalExists;
    restore();
  }
});
