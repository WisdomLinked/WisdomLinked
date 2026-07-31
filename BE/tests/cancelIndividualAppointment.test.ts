import test from "node:test";
import assert from "node:assert/strict";

// groupChat.controller destructures these at require time, so the dispatchers have to
// be installed before it loads; per-test behaviour is swapped through `stubs`.
const stripeController = require("../controllers/stripe.controller");
const notifications = require("../services/notifications");
const paymentController = require("../controllers/payment.controller");

type Stubs = {
  refund?: (pi: string, amount: any, mode: string) => any;
};

let stubs: Stubs = {};
const calls: Record<string, any[]> = {};
const record = (name: string, args: any[]) => {
  calls[name] = calls[name] || [];
  calls[name].push(args);
};

stripeController.refundPaymentIntent = async (pi: string, amount: any, mode: string) => {
  record("refund", [pi, amount, mode]);
  return stubs.refund ? stubs.refund(pi, amount, mode) : { payment_intent: pi };
};
stripeController.checkPaymentIntentAuthorized = async () => false;
stripeController.checkPaymentIntentSucceeded = async () => false;
stripeController.capturePaymentIntent = async () => false;
stripeController.cancelPaymentIntent = async () => ({ status: "canceled" });
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

const chatDoc = (overrides: any = {}) => ({
  _id: CHAT_ID,
  name: "PhD Application Advice",
  type: "individual",
  status: "pending",
  admin: EXPERT_ID,
  createdBy: EXPERT_ID,
  participants: [STUDENT_ID, EXPERT_ID],
  ...overrides,
});

const chargeRow = (overrides: any = {}) => ({
  _id: "eeeeeeeeeeeeeeeeeeeeeee5",
  paymentType: "charge",
  status: "completed",
  paymentIntent: "pi_paid",
  amount: 10000,
  currency: "usd",
  stripeMode: "test",
  customer: STUDENT_ID,
  expert: EXPERT_ID,
  groupChat: CHAT_ID,
  ...overrides,
});

/** Installs the model stubs the cancel path needs; returns a restore function. */
const withModels = ({ chat, payment, claimWins = true }: any) => {
  const original = {
    groupFindOne: GroupChat.findOne,
    groupFindOneAndUpdate: GroupChat.findOneAndUpdate,
    groupUpdateOne: GroupChat.updateOne,
    userFindById: User.findById,
    userUpdateOne: User.updateOne,
    historyFindOne: PaymentHistory.findOne,
    historyExists: PaymentHistory.exists,
    historyFindByIdAndUpdate: PaymentHistory.findByIdAndUpdate,
  };

  GroupChat.findOne = async () => chat;
  GroupChat.findOneAndUpdate = async (filter: any, update: any) => {
    record("claim", [filter, update]);
    return claimWins ? chat : null;
  };
  GroupChat.updateOne = async (filter: any, update: any) => {
    record("groupUpdateOne", [filter, update]);
    return { modifiedCount: 1 };
  };
  User.findById = async (id: any) => ({
    _id: String(id),
    email: String(id) === EXPERT_ID ? "expert@test.com" : "student@test.com",
    username: String(id) === EXPERT_ID ? "Expert" : "Student",
  });
  User.updateOne = async (filter: any, update: any) => {
    record("userUpdateOne", [filter, update]);
    return { modifiedCount: 1 };
  };
  PaymentHistory.findOne = async (filter: any) => {
    record("historyFindOne", [filter]);
    return payment || null;
  };
  PaymentHistory.exists = async () => null;
  PaymentHistory.findByIdAndUpdate = async (id: any, update: any) => {
    record("historyUpdate", [id, update]);
    return {};
  };

  return () => {
    GroupChat.findOne = original.groupFindOne;
    GroupChat.findOneAndUpdate = original.groupFindOneAndUpdate;
    GroupChat.updateOne = original.groupUpdateOne;
    User.findById = original.userFindById;
    User.updateOne = original.userUpdateOne;
    PaymentHistory.findOne = original.historyFindOne;
    PaymentHistory.exists = original.historyExists;
    PaymentHistory.findByIdAndUpdate = original.historyFindByIdAndUpdate;
  };
};

const resetCalls = () => {
  stubs = {};
  for (const key of Object.keys(calls)) delete calls[key];
};

const cancelAs = async (userId: string) => {
  const req: any = { user: { userId }, body: { groupChatId: CHAT_ID } };
  const res = createRes();
  await groupController.cancelIndividualAppointment(req, res);
  return res;
};

/** The status the claim wrote, ignoring any rollback that followed. */
const claimedStatus = () => calls.claim?.[0]?.[1]?.$set?.status;
const rolledBackToPending = () =>
  (calls.groupUpdateOne || []).some((c: any[]) => c[1]?.$set?.status === "pending");

test("expert withdraws their own unpaid proposal", async () => {
  resetCalls();
  const restore = withModels({ chat: chatDoc() });
  try {
    const res = await cancelAs(EXPERT_ID);

    assert.equal(res.statusCode, 200);
    assert.match(String(res.body), /withdrawn/i);
    assert.equal(claimedStatus(), "cancelled");
    assert.equal(rolledBackToPending(), false, "the cancellation must stand");
    assert.equal(calls.refund, undefined, "nothing was paid, so nothing is refunded");
    assert.equal(calls.userUpdateOne?.length, 2, "both sides drop the session");
    assert.match(String(calls.email?.[0]?.[0]), /student@test.com/);
  } finally {
    restore();
  }
});

test("expert cannot withdraw a proposal the student has already paid for", async () => {
  resetCalls();
  const restore = withModels({ chat: chatDoc(), payment: chargeRow() });
  try {
    const res = await cancelAs(EXPERT_ID);

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /already paid/i);
    assert.equal(rolledBackToPending(), true, "the session must be restored");
    assert.equal(calls.refund, undefined, "a paid session is not refunded from here");
    assert.equal(calls.userUpdateOne, undefined, "nobody is detached from the session");
  } finally {
    restore();
  }
});

test("expert cannot withdraw a proposal while its capture is still in flight", async () => {
  resetCalls();
  const restore = withModels({
    chat: chatDoc(),
    payment: chargeRow({ status: "pending" }),
  });
  try {
    const res = await cancelAs(EXPERT_ID);

    assert.equal(res.statusCode, 409);
    assert.equal(rolledBackToPending(), true);
    assert.equal(calls.refund, undefined);
  } finally {
    restore();
  }
});

test("an already-active proposal tells the expert to contact an admin", async () => {
  resetCalls();
  const restore = withModels({ chat: chatDoc({ status: "active" }) });
  try {
    const res = await cancelAs(EXPERT_ID);

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /already paid/i);
    assert.equal(calls.claim, undefined, "the status is never touched");
  } finally {
    restore();
  }
});

test("expert declining a paid student booking refunds the student", async () => {
  resetCalls();
  const restore = withModels({
    chat: chatDoc({ createdBy: STUDENT_ID }),
    payment: chargeRow(),
  });
  try {
    const res = await cancelAs(EXPERT_ID);

    assert.equal(res.statusCode, 200);
    assert.match(String(res.body), /refunded/i);
    assert.equal(calls.refund?.length, 1, "the student's money goes back");
    assert.equal(calls.refund?.[0]?.[1], 10000);
    assert.equal(calls.appendPaymentHistory?.[0]?.[0]?.paymentType, "refund");
    assert.equal(calls.appendPaymentHistory?.[0]?.[0]?.status, "refunded");
    assert.equal(calls.historyUpdate?.[0]?.[1]?.status, "refunded");
    assert.equal(rolledBackToPending(), false);
  } finally {
    restore();
  }
});

test("student cancelling their own unaccepted booking is still refunded", async () => {
  resetCalls();
  const restore = withModels({
    chat: chatDoc({ createdBy: STUDENT_ID }),
    payment: chargeRow(),
  });
  try {
    const res = await cancelAs(STUDENT_ID);

    assert.equal(res.statusCode, 200);
    assert.equal(calls.refund?.length, 1);
    assert.equal(calls.historyUpdate?.[0]?.[1]?.status, "refunded");
  } finally {
    restore();
  }
});

test("a failed refund leaves the session standing", async () => {
  resetCalls();
  const restore = withModels({
    chat: chatDoc({ createdBy: STUDENT_ID }),
    payment: chargeRow(),
  });
  try {
    stubs.refund = () => false;

    const res = await cancelAs(STUDENT_ID);

    assert.equal(res.statusCode, 502);
    assert.equal(rolledBackToPending(), true, "no cancellation without the refund");
    assert.equal(calls.userUpdateOne, undefined);
  } finally {
    restore();
  }
});

test("someone outside the session cannot cancel it", async () => {
  resetCalls();
  const restore = withModels({ chat: chatDoc() });
  try {
    const res = await cancelAs(OTHER_ID);

    assert.equal(res.statusCode, 403);
    assert.equal(calls.claim, undefined);
  } finally {
    restore();
  }
});

test("losing the race to another update cancels nothing", async () => {
  resetCalls();
  const restore = withModels({ chat: chatDoc(), claimWins: false });
  try {
    const res = await cancelAs(EXPERT_ID);

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /already been updated/i);
    assert.equal(calls.userUpdateOne, undefined);
    assert.equal(calls.refund, undefined);
  } finally {
    restore();
  }
});
