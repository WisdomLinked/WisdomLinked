import test from "node:test";
import assert from "node:assert/strict";

// groupChat.controller destructures these at require time, so the dispatchers have to
// be installed before it loads.
const stripeController = require("../controllers/stripe.controller");
const notifications = require("../services/notifications");
const paymentController = require("../controllers/payment.controller");

const calls: Record<string, any[]> = {};
const record = (name: string, args: any[]) => {
  calls[name] = calls[name] || [];
  calls[name].push(args);
};

stripeController.cancelPaymentIntent = async (pi: string) => {
  record("cancelIntent", [pi]);
  return { status: "canceled" };
};
stripeController.checkPaymentIntentAuthorized = async () => false;
stripeController.checkPaymentIntentSucceeded = async () => false;
stripeController.checkPaymentIntentProcessing = async () => false;
stripeController.capturePaymentIntent = async () => false;
stripeController.refundPaymentIntent = async (pi: string) => ({ payment_intent: pi });
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
paymentController.appendPaymentHistory = async () => true;

const groupController = require("../controllers/groupChat.controller");
const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const PaymentHistory = require("../models/PaymentHistory");
const AppState = require("../models/AppState");

const STUDENT_ID = "aaaaaaaaaaaaaaaaaaaaaaa1";
const EXPERT_ID = "bbbbbbbbbbbbbbbbbbbbbbb2";
const CHAT_ID = "ddddddddddddddddddddddd4";

const HOUR = 60 * 60 * 1000;

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

const offerDoc = (overrides: any = {}) => ({
  _id: CHAT_ID,
  name: "PhD Application Advice",
  type: "individual",
  status: "pending",
  price: 100,
  admin: EXPERT_ID,
  createdBy: EXPERT_ID,
  participants: [STUDENT_ID, EXPERT_ID],
  paymentMode: "card",
  start: new Date(Date.now() + 72 * HOUR),
  paymentDeadline: new Date(Date.now() - HOUR),
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

const withModels = ({ sessions = [], chat = null, claimWins = true }: any = {}) => {
  const original = {
    groupFind: GroupChat.find,
    groupFindOne: GroupChat.findOne,
    groupFindOneAndUpdate: GroupChat.findOneAndUpdate,
    groupUpdateOne: GroupChat.updateOne,
    userFindById: User.findById,
    userUpdateOne: User.updateOne,
    historyExists: PaymentHistory.exists,
    historyFindOne: PaymentHistory.findOne,
    historyFind: PaymentHistory.find,
    appStateFindOne: AppState.findOne,
  };

  GroupChat.find = (filter: any) => {
    record("groupFind", [filter]);
    return chainable(sessions);
  };
  GroupChat.findOne = async () => chat;
  GroupChat.findOneAndUpdate = async (filter: any, update: any) => {
    record("claim", [filter, update]);
    return claimWins ? sessions.find((s: any) => String(s._id) === String(filter?._id)) || chat : null;
  };
  GroupChat.updateOne = async () => ({ modifiedCount: 1 });
  User.findById = async (id: any) => ({
    _id: String(id),
    email: String(id) === EXPERT_ID ? "expert@test.com" : "student@test.com",
    username: String(id) === EXPERT_ID ? "Expert" : "Student",
  });
  User.updateOne = async (filter: any, update: any) => {
    record("userUpdateOne", [filter, update]);
    return { modifiedCount: 1 };
  };
  PaymentHistory.exists = async () => null;
  PaymentHistory.findOne = async () => null;
  PaymentHistory.find = () => chainable([]);
  AppState.findOne = () => chainable({ stripeMode: "test", paymentWindowHours: 48 });

  return () => {
    GroupChat.find = original.groupFind;
    GroupChat.findOne = original.groupFindOne;
    GroupChat.findOneAndUpdate = original.groupFindOneAndUpdate;
    GroupChat.updateOne = original.groupUpdateOne;
    User.findById = original.userFindById;
    User.updateOne = original.userUpdateOne;
    PaymentHistory.exists = original.historyExists;
    PaymentHistory.findOne = original.historyFindOne;
    PaymentHistory.find = original.historyFind;
    AppState.findOne = original.appStateFindOne;
  };
};

const resetCalls = () => {
  for (const key of Object.keys(calls)) delete calls[key];
};

const emailTo = (address: string) =>
  (calls.email || []).find((c: any[]) => String(c[0]) === address);

test("an expert's offer is released once its payment window lapses", async () => {
  resetCalls();
  const restore = withModels({ sessions: [offerDoc()] });
  try {
    const expired = await groupController.sweepExpiredProposedSessions();

    assert.equal(expired, 1);
    assert.equal(calls.claim?.[0]?.[1]?.$set?.status, "cancelled");
    assert.equal(calls.claim?.[0]?.[1]?.$set?.paymentDeadline, null);
    assert.equal(calls.userUpdateOne?.length, 2, "both sides drop the released session");
    assert.match(String(emailTo("student@test.com")?.[1]), /expired/i);
    assert.match(String(emailTo("expert@test.com")?.[1]), /expired/i);
  } finally {
    restore();
  }
});

test("the sweep only queries unpaid, non-wallet requests that are past due", async () => {
  resetCalls();
  const restore = withModels({ sessions: [] });
  try {
    await groupController.sweepExpiredProposedSessions();

    const filter = calls.groupFind?.[0]?.[0];
    assert.equal(filter?.type, "individual");
    assert.equal(filter?.status, "pending");
    assert.deepEqual(filter?.paymentMode, { $ne: "wallet" });
    assert.ok(filter?.paymentDeadline?.$lte instanceof Date);
  } finally {
    restore();
  }
});

test("a student's own request is not expired by the offer sweep", async () => {
  resetCalls();
  // createdBy is the student, so this is a request the expert still owes a decision on.
  const restore = withModels({ sessions: [offerDoc({ createdBy: STUDENT_ID })] });
  try {
    const expired = await groupController.sweepExpiredProposedSessions();

    assert.equal(expired, 0);
    assert.equal(calls.claim, undefined, "the request must be left for the expert to decide");
    assert.equal(calls.email, undefined);
  } finally {
    restore();
  }
});

test("paying for an offer after its window closed is refused", async () => {
  resetCalls();
  const restore = withModels({ chat: offerDoc() });
  try {
    const req: any = {
      user: { userId: STUDENT_ID, role: "customer" },
      body: { groupChatId: CHAT_ID, payment_intent: "pi_booking" },
    };
    const res = createRes();
    await groupController.acceptIndividualAppointment(req, res);

    assert.equal(res.statusCode, 410);
    assert.match(String(res.body), /payment window/i);
  } finally {
    restore();
  }
});

test("paying for an offer inside its window is not blocked by the deadline", async () => {
  resetCalls();
  const restore = withModels({
    chat: offerDoc({ paymentDeadline: new Date(Date.now() + HOUR) }),
  });
  try {
    const req: any = {
      user: { userId: STUDENT_ID, role: "customer" },
      body: { groupChatId: CHAT_ID, payment_intent: "pi_booking" },
    };
    const res = createRes();
    await groupController.acceptIndividualAppointment(req, res);

    assert.notEqual(res.statusCode, 410);
  } finally {
    restore();
  }
});
