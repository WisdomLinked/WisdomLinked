import test from "node:test";
import assert from "node:assert/strict";

const stripeController = require("../controllers/stripe.controller");
const notifications = require("../services/notifications");
const paymentController = require("../controllers/payment.controller");

type Stubs = {
  refund?: (pi: string, amount: any, mode: string) => any;
  cancelIntent?: (pi: string) => any;
  succeeded?: () => any;
  authorized?: () => any;
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
stripeController.checkPaymentIntentAuthorized = async () =>
  (stubs.authorized ? stubs.authorized() : false);
stripeController.checkPaymentIntentSucceeded = async () =>
  (stubs.succeeded ? stubs.succeeded() : false);
stripeController.capturePaymentIntent = async () => false;
stripeController.cancelPaymentIntent = async (pi: string) => {
  record("cancelIntent", [pi]);
  return stubs.cancelIntent ? stubs.cancelIntent(pi) : { status: "canceled" };
};
stripeController.sendBookingReceiptAndConfirmation = async () => {};
stripeController.listReconcilableBookingIntents = async () => [];

notifications.sendNotificationEmail = async (to: string, subject: string) => {
  record("email", [to, subject]);
};
notifications.sendEmailMeetingRequestToExpert = async () => {};
notifications.sendEmailMeetingRequestToCustomer = async () => {};
notifications.sendEmailSessionPaidToExpert = async () => {};
notifications.sendEmailMeetingAcceptance = async () => {};
notifications.sendSessionReminderEmail = async () => {};
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

const parkedRow = (overrides: any = {}) => chargeRow({
  _id: "fffffffffffffffffffffff6",
  status: "withheld",
  paymentIntent: "pi_held",
  ...overrides,
});

const withModels = ({ chat, payment, parked, claimWins = true }: any) => {
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
    notificationPreferences: prefsById[String(id)],
  });
  User.updateOne = async (filter: any, update: any) => {
    record("userUpdateOne", [filter, update]);
    return { modifiedCount: 1 };
  };
  PaymentHistory.findOne = async (filter: any) => {
    record("historyFindOne", [filter]);
    if (filter?.status === "withheld") return parked || null;
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

let prefsById: Record<string, any> = {};

const resetCalls = () => {
  stubs = {};
  prefsById = {};
  for (const key of Object.keys(calls)) delete calls[key];
};

const cancelAs = async (userId: string, note?: string) => {
  const req: any = { user: { userId }, body: { groupChatId: CHAT_ID, note } };
  const res = createRes();
  await groupController.cancelIndividualAppointment(req, res);
  return res;
};

const DECLINE_NOTE = "Unavailable that week — would 2:30pm Aug 19 work?";

const claimedStatus = () => calls.claim?.[0]?.[1]?.$set?.status;
const rolledBackToPending = () =>
  (calls.groupUpdateOne || []).some((c: any[]) => c[1]?.$set?.status === "pending");

const emailsTo = (address: string) => (calls.email || []).filter((c: any[]) => String(c[0]) === address);

// --- Bookings and approvals switch ------------------------------------------

test("a student with booking emails on hears about a declined request", async () => {
  resetCalls();
  const restore = withModels({ chat: chatDoc({ createdBy: STUDENT_ID }), parked: parkedRow() });
  try {
    const res = await cancelAs(EXPERT_ID, DECLINE_NOTE);
    assert.equal(res.statusCode, 200);
    assert.equal(emailsTo("student@test.com").length, 1);
  } finally {
    restore();
  }
});

test("a student who switched booking emails off is not emailed about a declined request", async () => {
  resetCalls();
  prefsById[STUDENT_ID] = { email: true, bookings: false };
  const restore = withModels({ chat: chatDoc({ createdBy: STUDENT_ID }), parked: parkedRow() });
  try {
    const res = await cancelAs(EXPERT_ID, DECLINE_NOTE);
    assert.equal(res.statusCode, 200, "the decline itself still goes through");
    assert.equal(calls.cancelIntent?.length, 1, "the hold is still released");
    assert.equal(emailsTo("student@test.com").length, 0);
  } finally {
    restore();
  }
});

test("the master email switch also stops booking emails", async () => {
  resetCalls();
  prefsById[STUDENT_ID] = { email: false, bookings: true };
  const restore = withModels({ chat: chatDoc({ createdBy: STUDENT_ID }), parked: parkedRow() });
  try {
    await cancelAs(EXPERT_ID, DECLINE_NOTE);
    assert.equal(emailsTo("student@test.com").length, 0);
  } finally {
    restore();
  }
});

test("switching off only the reminders does not stop booking emails", async () => {
  resetCalls();
  prefsById[STUDENT_ID] = { email: true, bookings: true, seminarReminders: false, sessionReminders: false };
  const restore = withModels({ chat: chatDoc({ createdBy: STUDENT_ID }), parked: parkedRow() });
  try {
    await cancelAs(EXPERT_ID, DECLINE_NOTE);
    assert.equal(emailsTo("student@test.com").length, 1);
  } finally {
    restore();
  }
});

test("an opted-out student is still told when their payment was refunded", async () => {
  resetCalls();
  prefsById[STUDENT_ID] = { email: false, bookings: false };
  const restore = withModels({ chat: chatDoc({ createdBy: STUDENT_ID }), payment: chargeRow() });
  try {
    const res = await cancelAs(EXPERT_ID, DECLINE_NOTE);
    assert.equal(res.statusCode, 200);
    const toStudent = emailsTo("student@test.com");
    assert.equal(toStudent.length, 1, "money moved, so the email is not optional");
    assert.match(String(toStudent[0][1]), /refunded/i);
  } finally {
    restore();
  }
});

test("an opted-out student is still told when a captured hold was refunded", async () => {
  resetCalls();
  prefsById[STUDENT_ID] = { email: true, bookings: false };
  const restore = withModels({ chat: chatDoc({ createdBy: STUDENT_ID }), parked: parkedRow() });
  try {
    stubs.cancelIntent = () => false;
    stubs.succeeded = () => ({ status: "succeeded" });
    await cancelAs(EXPERT_ID, DECLINE_NOTE);
    const toStudent = emailsTo("student@test.com");
    assert.equal(toStudent.length, 1);
    assert.match(String(toStudent[0][1]), /refunded/i);
  } finally {
    restore();
  }
});

test("a student opted out of booking emails is not told the expert withdrew an offer", async () => {
  resetCalls();
  prefsById[STUDENT_ID] = { bookings: false };
  const restore = withModels({ chat: chatDoc() });
  try {
    const res = await cancelAs(EXPERT_ID);
    assert.equal(res.statusCode, 200);
    assert.equal(emailsTo("student@test.com").length, 0);
  } finally {
    restore();
  }
});

test("an expert opted out of booking emails is not told a student declined their offer", async () => {
  resetCalls();
  prefsById[EXPERT_ID] = { bookings: false };
  const restore = withModels({ chat: chatDoc() });
  try {
    const res = await cancelAs(STUDENT_ID, "Thanks, but I found another slot.");
    assert.equal(res.statusCode, 200);
    assert.equal(emailsTo("expert@test.com").length, 0);
  } finally {
    restore();
  }
});

test("an expert opted out of booking emails is not told a student cancelled a request", async () => {
  resetCalls();
  prefsById[EXPERT_ID] = { bookings: false };
  const restore = withModels({ chat: chatDoc({ createdBy: STUDENT_ID }) });
  try {
    const res = await cancelAs(STUDENT_ID);
    assert.equal(res.statusCode, 200);
    assert.equal(emailsTo("expert@test.com").length, 0);
  } finally {
    restore();
  }
});

test("one person's switch never silences the other person", async () => {
  resetCalls();
  prefsById[STUDENT_ID] = { bookings: false };
  const restore = withModels({ chat: chatDoc({ createdBy: STUDENT_ID }) });
  try {
    await cancelAs(STUDENT_ID);
    assert.equal(emailsTo("expert@test.com").length, 1, "the expert still hears the slot is free");
  } finally {
    restore();
  }
});
