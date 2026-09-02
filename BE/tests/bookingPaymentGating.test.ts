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
stripeController.listReconcilableBookingIntents = async () => [];

notifications.sendEmailMeetingRequestToExpert = async () => {};
notifications.sendEmailMeetingRequestToCustomer = async () => {};
notifications.sendEmailSessionPaidToExpert = async () => {};
notifications.sendEmailMeetingAcceptance = async () => {};
notifications.sendNotificationEmail = async () => {};
notifications.scheduleEmailReminder = () => {};
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

test("a free 1:1 booking needs no payment intent", async () => {
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

    assert.equal(res.statusCode, 200);
    assert.equal(calls.groupCreate?.length, 1);
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
