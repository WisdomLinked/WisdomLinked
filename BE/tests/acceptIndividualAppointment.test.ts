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
let captureResult: any = false;
stripeController.capturePaymentIntent = async (pi: string) => {
  record("capture", [pi]);
  return captureResult;
};
stripeController.cancelPaymentIntent = async (pi: string) => {
  record("cancelIntent", [pi]);
  return { status: "canceled" };
};
stripeController.sendBookingReceiptAndConfirmation = async (args: any) => {
  record("receiptEmail", [args]);
};
stripeController.listReconcilableBookingIntents = async () => [];

notifications.sendNotificationEmail = async () => {};
notifications.sendEmailMeetingRequestToExpert = async () => {};
notifications.sendEmailMeetingRequestToCustomer = async () => {};
notifications.sendEmailSessionPaidToExpert = async () => {};
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

const parkedHold = (overrides: any = {}) => ({
  _id: "parked-row",
  paymentIntent: "pi_held",
  stripeMode: "test",
  amount: 10000,
  currency: "usd",
  customer: STUDENT_ID,
  expert: EXPERT_ID,
  groupChat: CHAT_ID,
  status: "withheld",
  ...overrides,
});

const withModels = ({ chat, paid = true, activateWins = true, parked = null }: any) => {
  const original = {
    groupFindOne: GroupChat.findOne,
    groupFindOneAndUpdate: GroupChat.findOneAndUpdate,
    groupUpdateOne: GroupChat.updateOne,
    userFindById: User.findById,
    historyExists: PaymentHistory.exists,
    historyFindOne: PaymentHistory.findOne,
    historyFindByIdAndUpdate: PaymentHistory.findByIdAndUpdate,
  };

  PaymentHistory.findOne = async () => parked;
  PaymentHistory.findByIdAndUpdate = async (id: any, update: any) => {
    record("historyUpdate", [String(id), update]);
    return { _id: id };
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
    PaymentHistory.findOne = original.historyFindOne;
    PaymentHistory.findByIdAndUpdate = original.historyFindByIdAndUpdate;
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

const withCapture = (result: any) => {
  captureResult = result;
  return () => {
    captureResult = false;
  };
};

const capturedIntent = {
  status: "succeeded",
  amount_received: 10000,
  currency: "usd",
  latest_charge: { receipt_url: "https://receipt", receipt_number: "R-1" },
};

test("an expert accepting a held request captures the authorization", async () => {
  resetCalls();
  const restore = withModels({ chat: studentRequest(), paid: false, parked: parkedHold() });
  const restoreCapture = withCapture(capturedIntent);
  try {
    const res = await acceptAs(EXPERT_ID, "expert");

    assert.equal(res.statusCode, 200);
    assert.equal(activatedStatus(), "active");
    assert.equal(calls.capture?.[0]?.[0], "pi_held", "the held intent is the one captured");
    const settled = calls.historyUpdate?.find((c: any[]) => c[1]?.status === "completed");
    assert.ok(settled, "the withheld row is settled to completed");
    assert.equal(settled[0], "parked-row", "the existing row is settled, not a new one");
    assert.equal(calls.appendPaymentHistory, undefined, "no duplicate charge row is written");
  } finally {
    restoreCapture();
    restore();
  }
});

test("a hold that can no longer be captured leaves the session pending", async () => {
  resetCalls();
  const chat = studentRequest();
  const restore = withModels({ chat, paid: false, parked: parkedHold() });
  const restoreCapture = withCapture(false);
  try {
    const res = await acceptAs(EXPERT_ID, "expert");

    assert.equal(res.statusCode, 502);
    assert.match(String(res.body), /authorization has expired|has not been confirmed/i);
    const rolledBack = calls.groupUpdateOne?.find(
      (c: any[]) => c[1]?.$set?.status === "pending",
    );
    assert.ok(rolledBack, "the session is put back to pending");
  } finally {
    restoreCapture();
    restore();
  }
});

test("an expert cannot accept once the decision deadline has passed", async () => {
  resetCalls();
  const chat = studentRequest({ decisionDeadline: new Date(Date.now() - 1000) });
  const restore = withModels({ chat, paid: false, parked: parkedHold() });
  try {
    const res = await acceptAs(EXPERT_ID, "expert");

    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /time to decide/i);
    assert.equal(calls.activate, undefined, "an expired request is not activated");
    assert.equal(calls.capture, undefined, "no capture is attempted");
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

test("a paid accept sends one email: the note rides on the receipt", async () => {
  resetCalls();
  const restore = withModels({ chat: studentRequest(), paid: false, parked: parkedHold() });
  const restoreCapture = withCapture(capturedIntent);
  try {
    await acceptAs(EXPERT_ID, "expert", { note: "See you then — bring your draft." });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(calls.receiptEmail?.length, 1, "the receipt is sent");
    assert.match(
      String(calls.receiptEmail?.[0]?.[0]?.noteHtml || ""),
      /bring your draft/i,
      "the expert's note travels with the receipt",
    );
    assert.equal(
      calls.acceptanceEmail,
      undefined,
      "no second email repeating what the receipt already said",
    );
  } finally {
    restoreCapture();
    restore();
  }
});

test("a free accept still gets its own acceptance email", async () => {
  resetCalls();
  const restore = withModels({ chat: studentRequest(), paid: false, parked: null });
  try {
    await acceptAs(EXPERT_ID, "expert", { note: "Looking forward to it." });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(calls.receiptEmail, undefined, "nothing was charged, so no receipt");
    assert.match(
      String(calls.acceptanceEmail?.[0]?.[1] || ""),
      /looking forward/i,
      "the student is still told, and still gets the note",
    );
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
