import test from "node:test";
import assert from "node:assert/strict";

const stripeController = require("../controllers/stripe.controller");
const notifications = require("../services/notifications");
const paymentController = require("../controllers/payment.controller");

type Stubs = {
  authorized?: (pi: string, mode: string) => any;
  succeeded?: (pi: string, mode: string) => any;
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
  return false;
};
stripeController.cancelPaymentIntent = async (pi: string, mode: string) => {
  record("cancel", [pi, mode]);
  return { status: "canceled" };
};
stripeController.refundPaymentIntent = async (pi: string, amount: any, mode: string) => {
  record("refund", [pi, amount, mode]);
  return { payment_intent: pi };
};
stripeController.checkPaymentIntentProcessing = async () => false;
stripeController.sendBookingReceiptAndConfirmation = async () => {};
stripeController.listReconcilableBookingIntents = async () => [];

notifications.sendNotificationEmail = async (to: string, subject: string) => {
  record("email", [to, subject]);
};
notifications.sendEmailMeetingRequestToExpert = async () => {};
notifications.sendEmailMeetingRequestToCustomer = async () => {};
notifications.sendEmailSessionPaidToExpert = async () => {};
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
const SeminarSeatRequest = require("../models/SeminarSeatRequest");

const STUDENT_ID = "aaaaaaaaaaaaaaaaaaaaaaa1";
const EXPERT_ID = "bbbbbbbbbbbbbbbbbbbbbbb2";
const CHAT_ID = "ddddddddddddddddddddddd4";
const PAYING_INTENT = "pi_paid_for_this_session";
const PRICE_CENTS = 10000;

const createRes = () => ({
  statusCode: 200,
  body: null as any,
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
});

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

const confirmedSession = (overrides: any = {}) => ({
  _id: CHAT_ID,
  name: "expert @gmail initiated session to @gmail at a higher rate",
  type: "individual",
  status: "active",
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

const succeededIntent = (overrides: any = {}) => {
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

const chargeRow = (overrides: any = {}) => ({
  paymentType: "charge",
  status: "completed",
  paymentIntent: PAYING_INTENT,
  customer: STUDENT_ID,
  groupChat: CHAT_ID,
  ...overrides,
});

const refundRow = (overrides: any = {}) => ({
  paymentType: "refund",
  status: "refunded",
  paymentIntent: PAYING_INTENT,
  customer: STUDENT_ID,
  groupChat: CHAT_ID,
  ...overrides,
});

const withModels = ({ chat, historyRows = [] as any[] }: any) => {
  const original = {
    groupFindOne: GroupChat.findOne,
    groupFindById: GroupChat.findById,
    groupFindOneAndUpdate: GroupChat.findOneAndUpdate,
    groupUpdateOne: GroupChat.updateOne,
    userFindById: User.findById,
    appStateFindOne: AppState.findOne,
    historyExists: PaymentHistory.exists,
    historyFind: PaymentHistory.find,
    historyFindOneAndUpdate: PaymentHistory.findOneAndUpdate,
    seatExists: SeminarSeatRequest.exists,
  };

  GroupChat.findOne = async () => chat;
  GroupChat.findById = () => ({ select: async () => chat });
  GroupChat.findOneAndUpdate = async (filter: any, update: any) => {
    record("groupFindOneAndUpdate", [filter, update]);
    if (filter?.status && chat && filter.status !== chat.status) return null;
    return chat;
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
  PaymentHistory.exists = async () => null;
  PaymentHistory.find = (query: any) => ({
    select: async () => {
      const wantedTypes = query?.paymentType?.$in || [query?.paymentType];
      return historyRows.filter((row: any) => {
        if (!wantedTypes.includes(row.paymentType)) return false;
        if (query?.paymentIntent && String(query.paymentIntent) !== String(row.paymentIntent)) return false;
        if (query?.groupChat && String(query.groupChat) !== String(row.groupChat)) return false;
        return true;
      });
    },
  });
  PaymentHistory.findOneAndUpdate = async () => null;
  SeminarSeatRequest.exists = async () => null;

  return () => {
    GroupChat.findOne = original.groupFindOne;
    GroupChat.findById = original.groupFindById;
    GroupChat.findOneAndUpdate = original.groupFindOneAndUpdate;
    GroupChat.updateOne = original.groupUpdateOne;
    User.findById = original.userFindById;
    AppState.findOne = original.appStateFindOne;
    PaymentHistory.exists = original.historyExists;
    PaymentHistory.find = original.historyFind;
    PaymentHistory.findOneAndUpdate = original.historyFindOneAndUpdate;
    SeminarSeatRequest.exists = original.seatExists;
  };
};

const resetCalls = () => {
  stubs = {};
  for (const key of Object.keys(calls)) delete calls[key];
};

const acceptAgainAsStudent = async (payment_intent: string) => {
  const req: any = {
    user: { userId: STUDENT_ID, role: "customer" },
    body: { groupChatId: CHAT_ID, payment_intent },
  };
  const res = createRes();
  await groupController.acceptIndividualAppointment(req, res);
  return res;
};

test("the intent that paid for a confirmed session is never clawed back by a duplicate accept", async () => {
  resetCalls();
  const restore = withModels({
    chat: confirmedSession(),
    historyRows: [chargeRow()],
  });
  try {
    stubs.succeeded = () => succeededIntent();

    const res = await acceptAgainAsStudent(PAYING_INTENT);

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /already been confirmed/i);
    assert.equal(calls.refund, undefined, "the paying charge is left alone");
    assert.equal(calls.cancel, undefined, "the paying intent is not cancelled either");
  } finally {
    restore();
  }
});

test("a stray second intent on a confirmed session is still given back", async () => {
  resetCalls();
  const restore = withModels({
    chat: confirmedSession(),
    historyRows: [chargeRow()],
  });
  try {
    stubs.succeeded = () => succeededIntent();

    const res = await acceptAgainAsStudent("pi_a_second_unused_intent");

    assert.equal(res.statusCode, 409);
    assert.equal(calls.refund?.length, 1, "the unrecorded duplicate is refunded");
    assert.equal(calls.refund[0][0], "pi_a_second_unused_intent");
  } finally {
    restore();
  }
});

test("a refund for a booking is attributed to its expert and session", async () => {
  resetCalls();
  const restore = withModels({
    chat: confirmedSession({ status: "pending" }),
    historyRows: [],
  });
  try {
    stubs.succeeded = () => succeededIntent();

    await acceptAgainAsStudent("pi_stray");

    const refundRecord = (calls.appendPaymentHistory || [])
      .map(([row]: any[]) => row)
      .find((row: any) => row.paymentType === "refund");
    assert.ok(refundRecord, "a refund row is written");
    assert.equal(String(refundRecord.expert), EXPERT_ID, "the expert's revenue page can see it");
    assert.equal(String(refundRecord.groupChat), CHAT_ID, "the refund names the session");
  } finally {
    restore();
  }
});

test("a session whose only charge was refunded does not stay confirmed", async () => {
  resetCalls();
  const chat = confirmedSession();
  const restore = withModels({
    chat,
    historyRows: [chargeRow(), refundRow()],
  });
  try {
    await groupController.reconcileRefundedSession(CHAT_ID, "Session is already confirmed");

    const release = (calls.groupFindOneAndUpdate || []).find(
      ([filter, update]: any[]) => filter?.status === "active" && update?.$set?.status === "cancelled",
    );
    assert.ok(release, "the session is released rather than left confirmed");
    const notified = (calls.email || []).map(([to]: any[]) => to);
    assert.ok(notified.includes("expert@test.com"), "the expert is told");
    assert.ok(notified.includes("student@test.com"), "the student is told");
  } finally {
    restore();
  }
});

test("a session that still has an unrefunded charge stays confirmed", async () => {
  resetCalls();
  const restore = withModels({
    chat: confirmedSession(),
    historyRows: [
      chargeRow({ paymentIntent: "pi_first_attempt" }),
      refundRow({ paymentIntent: "pi_first_attempt" }),
      chargeRow({ paymentIntent: "pi_successful_retry" }),
    ],
  });
  try {
    await groupController.reconcileRefundedSession(CHAT_ID, "Refund of a superseded attempt");

    const release = (calls.groupFindOneAndUpdate || []).find(
      ([filter, update]: any[]) => update?.$set?.status === "cancelled",
    );
    assert.equal(release, undefined, "a paid session is not released");
    assert.equal(calls.email, undefined, "nobody is warned about a session that is fine");
  } finally {
    restore();
  }
});
