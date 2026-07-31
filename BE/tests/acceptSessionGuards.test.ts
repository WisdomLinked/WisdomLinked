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
  return { status: "canceled" };
};
stripeController.refundPaymentIntent = async (pi: string, amount: any, mode: string) => {
  record("refund", [pi, amount, mode]);
  return { payment_intent: pi };
};
stripeController.sendBookingReceiptAndConfirmation = async () => {};
stripeController.listReconcilableBookingIntents = async () => [];

notifications.sendNotificationEmail = async () => {};
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
const AppState = require("../models/AppState");
const PaymentHistory = require("../models/PaymentHistory");

const STUDENT_ID = "aaaaaaaaaaaaaaaaaaaaaaa1";
const EXPERT_ID = "bbbbbbbbbbbbbbbbbbbbbbb2";
const CHAT_ID = "ddddddddddddddddddddddd4";
const PRICE_CENTS = 5000;

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

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

/** An expert-proposed session awaiting the student's payment. */
const proposalDoc = (overrides: any = {}) => ({
  _id: CHAT_ID,
  name: "PhD Application Advice",
  type: "individual",
  status: "pending",
  price: PRICE_CENTS / 100,
  start: hoursFromNow(48),
  end: hoursFromNow(49),
  duration: 60,
  admin: EXPERT_ID,
  createdBy: EXPERT_ID,
  participants: [STUDENT_ID, EXPERT_ID],
  save: async function save() {
    return this;
  },
  ...overrides,
});

const heldIntent = (overrides: any = {}) => {
  const { metadata, ...rest } = overrides;
  return {
    amount: PRICE_CENTS,
    currency: "usd",
    latest_charge: null,
    ...rest,
    metadata: {
      bookingType: "groupChat",
      groupChatId: CHAT_ID,
      userId: STUDENT_ID,
      ...(metadata || {}),
    },
  };
};

const withModels = ({ chat, alreadyPaid = false, activation = 'ok' }: any) => {
  const original = {
    groupFindOne: GroupChat.findOne,
    groupFindOneAndUpdate: GroupChat.findOneAndUpdate,
    groupUpdateOne: GroupChat.updateOne,
    userFindById: User.findById,
    appStateFindOne: AppState.findOne,
    historyExists: PaymentHistory.exists,
    historyFind: PaymentHistory.find,
    historyFindByIdAndUpdate: PaymentHistory.findByIdAndUpdate,
    historySave: PaymentHistory.prototype.save,
  };

  GroupChat.findOne = async () => chat;
  GroupChat.findOneAndUpdate = async (filter: any, update: any) => {
    record("activate", [filter, update]);
    return activation === 'lost' ? null : chat;
  };
  GroupChat.updateOne = async (filter: any, update: any) => {
    record("groupUpdateOne", [filter, update]);
    return { modifiedCount: 1 };
  };
  User.findById = async (id: any) => ({
    _id: String(id),
    email: String(id) === EXPERT_ID ? "expert@test.com" : "student@test.com",
    username: String(id) === EXPERT_ID ? "Expert" : "Student",
    timeZone: "UTC",
  });
  AppState.findOne = async () => ({ stripeMode: "test" });
  PaymentHistory.exists = async () => (alreadyPaid ? { _id: "row" } : null);
  PaymentHistory.find = () => ({ select: async () => [] });
  PaymentHistory.findByIdAndUpdate = async () => ({});
  PaymentHistory.prototype.save = async function (this: any) {
    record("historySave", [{ status: this.status }]);
    return this;
  };

  return () => {
    GroupChat.findOne = original.groupFindOne;
    GroupChat.findOneAndUpdate = original.groupFindOneAndUpdate;
    GroupChat.updateOne = original.groupUpdateOne;
    User.findById = original.userFindById;
    AppState.findOne = original.appStateFindOne;
    PaymentHistory.exists = original.historyExists;
    PaymentHistory.find = original.historyFind;
    PaymentHistory.findByIdAndUpdate = original.historyFindByIdAndUpdate;
    PaymentHistory.prototype.save = original.historySave;
  };
};

const resetCalls = () => {
  stubs = {};
  for (const key of Object.keys(calls)) delete calls[key];
};

const acceptAsStudent = async () => {
  const req: any = {
    user: { userId: STUDENT_ID, role: "customer" },
    body: { groupChatId: CHAT_ID, payment_intent: "pi_accept" },
  };
  const res = createRes();
  await groupController.acceptIndividualAppointment(req, res);
  return res;
};

test("a session that is already active cannot be paid for a second time", async () => {
  resetCalls();
  const restore = withModels({ chat: proposalDoc({ status: "active" }) });
  try {
    stubs.authorized = () => heldIntent();

    const res = await acceptAsStudent();

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /already been confirmed/i);
    assert.equal(calls.capture, undefined, "no second capture");
    assert.equal(calls.cancel?.length, 1, "the duplicate hold is released");
  } finally {
    restore();
  }
});

test("a session that already has a charge cannot be paid again while still pending", async () => {
  resetCalls();
  const restore = withModels({ chat: proposalDoc(), alreadyPaid: true });
  try {
    stubs.authorized = () => heldIntent();

    const res = await acceptAsStudent();

    assert.equal(res.statusCode, 409);
    assert.equal(calls.capture, undefined);
    assert.equal(calls.activate, undefined, "the session is not re-activated");
  } finally {
    restore();
  }
});

test("an offer whose start time has passed can no longer be paid for", async () => {
  resetCalls();
  const restore = withModels({ chat: proposalDoc({ start: hoursFromNow(-2), end: hoursFromNow(-1) }) });
  try {
    stubs.authorized = () => heldIntent();

    const res = await acceptAsStudent();

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body), /start time has already passed/i);
    assert.equal(calls.capture, undefined);
    assert.equal(calls.cancel?.length, 1, "the hold is released");
  } finally {
    restore();
  }
});

test("an offer withdrawn while the student pays is not resurrected", async () => {
  resetCalls();
  const restore = withModels({ chat: proposalDoc(), activation: 'lost' });
  try {
    stubs.authorized = () => heldIntent();

    const res = await acceptAsStudent();

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /cancelled while your payment/i);
    assert.equal(calls.capture, undefined, "a withdrawn session is never captured");
    assert.equal(calls.cancel?.length, 1, "the hold is released, so no charge lands");
  } finally {
    restore();
  }
});

test("a valid, unpaid, future offer still activates and captures", async () => {
  resetCalls();
  const restore = withModels({ chat: proposalDoc() });
  try {
    stubs.authorized = () => heldIntent();
    stubs.capture = () => ({ amount: PRICE_CENTS, currency: "usd", paidBy: "test" });

    const res = await acceptAsStudent();

    assert.equal(res.statusCode, 200);
    assert.equal(calls.capture?.length, 1);
    assert.equal(calls.activate?.length, 1);
    assert.equal(calls.cancel, undefined);
  } finally {
    restore();
  }
});
