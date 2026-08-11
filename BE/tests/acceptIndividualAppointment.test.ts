import test from "node:test";
import assert from "node:assert/strict";

// groupChat.controller destructures these at require time, so the dispatchers have
// to be installed before it loads; per-test behaviour is swapped through `stubs`.
const stripeController = require("../controllers/stripe.controller");
const notifications = require("../services/notifications");
const paymentController = require("../controllers/payment.controller");

const calls: Record<string, any[]> = {};
const record = (name: string, args: any[]) => {
  calls[name] = calls[name] || [];
  calls[name].push(args);
};

stripeController.refundPaymentIntent = async () => ({ payment_intent: "pi" });
stripeController.checkPaymentIntentAuthorized = async () => false;
stripeController.checkPaymentIntentSucceeded = async () => false;
stripeController.capturePaymentIntent = async () => false;
stripeController.cancelPaymentIntent = async (pi: string) => {
  record("cancelIntent", [pi]);
  return { status: "canceled" };
};
stripeController.sendBookingReceiptAndConfirmation = async () => {};
stripeController.listReconcilableBookingIntents = async () => [];

notifications.sendNotificationEmail = async () => {};
notifications.sendEmailMeetingRequestToExpert = async () => {};
notifications.sendEmailMeetingRequestToCustomer = async () => {};
notifications.sendEmailMeetingAcceptance = async (
  to: string,
  _name: string,
  _title: string,
  _start: any,
  _duration: any,
  _tz: any,
  noteHtml: string,
) => {
  record("acceptanceEmail", [to, noteHtml]);
};
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

/** A 1:1 the student booked and paid for, now waiting on the expert. */
const studentRequest = (overrides: any = {}) => ({
  _id: CHAT_ID,
  name: "PhD Application Advice",
  type: "individual",
  status: "pending",
  admin: EXPERT_ID,
  createdBy: STUDENT_ID,
  participants: [STUDENT_ID, EXPERT_ID],
  start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  duration: 60,
  price: 100,
  ...overrides,
});

const withModels = ({ chat, paid = true, activateWins = true }: any) => {
  const original = {
    groupFindOne: GroupChat.findOne,
    groupFindOneAndUpdate: GroupChat.findOneAndUpdate,
    groupUpdateOne: GroupChat.updateOne,
    userFindById: User.findById,
    historyExists: PaymentHistory.exists,
  };

  GroupChat.findOne = async () => chat;
  GroupChat.findOneAndUpdate = async (filter: any, update: any) => {
    record("activate", [filter, update]);
    return activateWins ? chat : null;
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
  PaymentHistory.exists = async () => (paid ? { _id: "charge-row" } : null);

  return () => {
    GroupChat.findOne = original.groupFindOne;
    GroupChat.findOneAndUpdate = original.groupFindOneAndUpdate;
    GroupChat.updateOne = original.groupUpdateOne;
    User.findById = original.userFindById;
    PaymentHistory.exists = original.historyExists;
  };
};

const resetCalls = () => {
  for (const key of Object.keys(calls)) delete calls[key];
};

const acceptAs = async (userId: string, role: string, body: any = {}) => {
  const req: any = { user: { userId, role }, body: { groupChatId: CHAT_ID, ...body } };
  const res = createRes();
  await groupController.acceptIndividualAppointment(req, res);
  return res;
};

const activatedStatus = () => calls.activate?.[0]?.[1]?.$set?.status;

// The regression: a student pays up front, so the pending session already carries
// a completed charge. Treating that as "already confirmed" made it impossible for
// an expert to ever accept a paid 1:1 request.
test("an expert can accept a student request that is already paid for", async () => {
  resetCalls();
  const restore = withModels({ chat: studentRequest(), paid: true });
  try {
    const res = await acceptAs(EXPERT_ID, "expert");

    assert.equal(res.statusCode, 200);
    assert.equal(activatedStatus(), "active");
  } finally {
    restore();
  }
});

test("an expert accepting takes no second payment", async () => {
  resetCalls();
  const restore = withModels({ chat: studentRequest(), paid: true });
  try {
    await acceptAs(EXPERT_ID, "expert");

    assert.equal(calls.appendPaymentHistory, undefined, "no new charge is recorded");
    assert.equal(calls.cancelIntent, undefined);
  } finally {
    restore();
  }
});

test("an expert can also accept an unpaid request", async () => {
  resetCalls();
  const restore = withModels({ chat: studentRequest(), paid: false });
  try {
    const res = await acceptAs(EXPERT_ID, "expert");

    assert.equal(res.statusCode, 200);
    assert.equal(activatedStatus(), "active");
  } finally {
    restore();
  }
});

test("a student cannot pay twice for the same session", async () => {
  resetCalls();
  const restore = withModels({
    chat: studentRequest({ createdBy: EXPERT_ID }),
    paid: true,
  });
  try {
    const res = await acceptAs(STUDENT_ID, "customer");

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /already been confirmed and paid for/i);
    assert.equal(calls.activate, undefined, "nothing is activated");
  } finally {
    restore();
  }
});

test("an already-active session is rejected for both sides", async () => {
  const cases = [
    { id: EXPERT_ID, role: "expert", createdBy: STUDENT_ID },
    { id: STUDENT_ID, role: "customer", createdBy: EXPERT_ID },
  ];
  for (const { id, role, createdBy } of cases) {
    resetCalls();
    const restore = withModels({
      chat: studentRequest({ status: "active", createdBy }),
      paid: true,
    });
    try {
      const res = await acceptAs(id, role);
      assert.equal(res.statusCode, 409, `${role} should be refused`);
      assert.match(String(res.body), /already been confirmed/i);
      assert.equal(calls.activate, undefined, "an active session is not re-activated");
    } finally {
      restore();
    }
  }
});

test("an expert is still told to leave their own proposal to the student", async () => {
  resetCalls();
  const restore = withModels({ chat: studentRequest({ createdBy: EXPERT_ID }), paid: false });
  try {
    const res = await acceptAs(EXPERT_ID, "expert");

    assert.equal(res.statusCode, 403);
    assert.match(String(res.body), /must accept and pay/i);
  } finally {
    restore();
  }
});

test("the expert's acceptance note reaches the student's email", async () => {
  resetCalls();
  const restore = withModels({ chat: studentRequest(), paid: true });
  try {
    await acceptAs(EXPERT_ID, "expert", { note: "See you then — bring your draft." });
    // The email is sent from a detached async block; let it drain.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const stored = calls.activate?.[0]?.[1]?.$set;
    assert.equal(stored?.decisionNote, "See you then — bring your draft.");
    assert.ok(stored?.decisionNoteAt);
    assert.match(String(calls.acceptanceEmail?.[0]?.[1] || ""), /bring your draft/i);
  } finally {
    restore();
  }
});

test("a cancelled session cannot be accepted", async () => {
  resetCalls();
  const restore = withModels({ chat: studentRequest({ status: "cancelled" }), paid: true });
  try {
    const res = await acceptAs(EXPERT_ID, "expert");

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body), /cancelled/i);
  } finally {
    restore();
  }
});

test("a session whose start time has passed cannot be accepted", async () => {
  resetCalls();
  const restore = withModels({
    chat: studentRequest({ start: new Date(Date.now() - 60 * 60 * 1000) }),
    paid: true,
  });
  try {
    const res = await acceptAs(EXPERT_ID, "expert");

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body), /already passed/i);
  } finally {
    restore();
  }
});

test("someone outside the session cannot accept it", async () => {
  resetCalls();
  const restore = withModels({ chat: studentRequest(), paid: true });
  try {
    const res = await acceptAs("ccccccccccccccccccccccc3", "expert");

    assert.equal(res.statusCode, 403);
    assert.equal(calls.activate, undefined);
  } finally {
    restore();
  }
});
