import test from "node:test";
import assert from "node:assert/strict";

const stripeController = require("../controllers/stripe.controller");
const notifications = require("../services/notifications");
const paymentController = require("../controllers/payment.controller");

let stubs: any = {};
const calls: Record<string, any[]> = {};
const record = (name: string, args: any[]) => {
  calls[name] = calls[name] || [];
  calls[name].push(args);
};

stripeController.checkPaymentIntentAuthorized = async () => false;
stripeController.checkPaymentIntentSucceeded = async () => false;
stripeController.capturePaymentIntent = async () => false;
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
notifications.scheduleEmailReminder = () => {};
paymentController.appendPaymentHistory = async (data: any) => {
  record("appendPaymentHistory", [data]);
  return true;
};

const groupController = require("../controllers/groupChat.controller");
const GroupChat = require("../models/GroupChat");
const User = require("../models/User");
const PaymentHistory = require("../models/PaymentHistory");
const SeminarSeatRequest = require("../models/SeminarSeatRequest");

const STUDENT_ID = "aaaaaaaaaaaaaaaaaaaaaaa1";
const EXPERT_ID = "bbbbbbbbbbbbbbbbbbbbbbb2";
const CHAT_ID = "ddddddddddddddddddddddd4";

const resetCalls = () => {
  stubs = {};
  for (const key of Object.keys(calls)) delete calls[key];
};

const bookingEvent = (type: string, overrides: any = {}) => {
  const { metadata, ...rest } = overrides;
  return {
    id: "evt_1",
    type,
    livemode: false,
    data: {
      object: {
        id: "pi_hook",
        amount: 10000,
        amount_received: 10000,
        currency: "usd",
        created: Math.floor(Date.now() / 1000),
        ...rest,
        metadata: {
          bookingType: "groupChat",
          groupChatId: CHAT_ID,
          userId: STUDENT_ID,
          ...(metadata || {}),
        },
      },
    },
  };
};

const withWebhookModels = (opts: any = {}) => {
  const original = {
    historyFind: PaymentHistory.find,
    historyExists: PaymentHistory.exists,
    historyUpdateOne: PaymentHistory.updateOne,
    groupExists: GroupChat.exists,
    groupFindById: GroupChat.findById,
    groupUpdateOne: GroupChat.updateOne,
    seatExists: SeminarSeatRequest.exists,
    userFindById: User.findById,
  };

  PaymentHistory.find = () => ({
    select: async () => opts.pendingRows ?? [],
  });
  PaymentHistory.exists = async () => opts.recorded ?? null;
  PaymentHistory.updateOne = async (filter: any, update: any) => {
    record("historyUpdateOne", [filter, update]);
    return { modifiedCount: 1 };
  };
  GroupChat.exists = async () => (opts.delivered ? { _id: CHAT_ID } : null);
  GroupChat.findById = (id: any) => ({
    select: async () => ({ _id: id, admin: EXPERT_ID, type: opts.chatType ?? "seminar", status: "active" }),
  });
  GroupChat.updateOne = async (filter: any, update: any) => {
    record("groupUpdateOne", [filter, update]);
    return { modifiedCount: 1 };
  };
  SeminarSeatRequest.exists = async () => opts.heldByRequest ?? null;
  User.findById = async (id: any) => ({ _id: id, email: "s@test.com", username: "S" });

  return () => {
    PaymentHistory.find = original.historyFind;
    PaymentHistory.exists = original.historyExists;
    PaymentHistory.updateOne = original.historyUpdateOne;
    GroupChat.exists = original.groupExists;
    GroupChat.findById = original.groupFindById;
    GroupChat.updateOne = original.groupUpdateOne;
    SeminarSeatRequest.exists = original.seatExists;
    User.findById = original.userFindById;
  };
};

test("webhook ignores payment intents that are not bookings", async () => {
  resetCalls();
  const restore = withWebhookModels();
  try {
    const event = bookingEvent("payment_intent.succeeded", { metadata: { bookingType: "adhoc" } });
    const outcome = await groupController.handleBookingPaymentIntentEvent(event);
    assert.equal(outcome, "ignored");
    assert.equal(calls.appendPaymentHistory, undefined);
  } finally {
    restore();
  }
});

test("webhook does not re-record a payment a request already recorded", async () => {
  resetCalls();
  const restore = withWebhookModels({ recorded: { _id: "ph1" } });
  try {
    const outcome = await groupController.handleBookingPaymentIntentEvent(
      bookingEvent("payment_intent.succeeded"),
    );
    assert.equal(outcome, "already_recorded");
    assert.equal(calls.appendPaymentHistory, undefined, "replays must not duplicate the charge");
  } finally {
    restore();
  }
});

test("webhook leaves a seat-request hold to the approval flow", async () => {
  resetCalls();
  const restore = withWebhookModels({ heldByRequest: { _id: "req1" } });
  try {
    const outcome = await groupController.handleBookingPaymentIntentEvent(
      bookingEvent("payment_intent.succeeded"),
    );
    assert.equal(outcome, "held_by_seat_request");
    assert.equal(calls.appendPaymentHistory, undefined);
  } finally {
    restore();
  }
});

test("webhook records a delivered booking whose charge row was lost", async () => {
  resetCalls();
  const restore = withWebhookModels({ delivered: true });
  try {
    const outcome = await groupController.handleBookingPaymentIntentEvent(
      bookingEvent("payment_intent.succeeded"),
    );
    assert.equal(outcome, "recorded");
    const row = calls.appendPaymentHistory?.[0]?.[0];
    assert.equal(row.status, "completed");
    assert.equal(row.paymentIntent, "pi_hook");
    assert.equal(row.amount, 10000);
    assert.equal(row.customer, STUDENT_ID);
  } finally {
    restore();
  }
});

test("webhook does NOT refund an undelivered success — a request may still be in flight", async () => {
  resetCalls();
  const restore = withWebhookModels({ delivered: false });
  try {
    const outcome = await groupController.handleBookingPaymentIntentEvent(
      bookingEvent("payment_intent.succeeded"),
    );
    assert.equal(outcome, "awaiting_sweep");
    assert.equal(calls.refund, undefined, "refunding here would kill a live booking");
    assert.equal(calls.appendPaymentHistory, undefined);
  } finally {
    restore();
  }
});

test("a failed payment marks the pending row failed and revokes the claim", async () => {
  resetCalls();
  const restore = withWebhookModels({
    pendingRows: [{ _id: "ph1", groupChat: CHAT_ID, customer: STUDENT_ID }],
    chatType: "seminar",
  });
  try {
    const outcome = await groupController.handleBookingPaymentIntentEvent(
      bookingEvent("payment_intent.payment_failed"),
    );
    assert.equal(outcome, "failed_rolled_back");
    assert.equal(calls.historyUpdateOne?.[0]?.[1]?.$set?.status, "failed");
  } finally {
    restore();
  }
});

test("a canceled payment cancels an unpaid 1:1 session", async () => {
  resetCalls();
  const restore = withWebhookModels({
    pendingRows: [{ _id: "ph1", groupChat: CHAT_ID, customer: STUDENT_ID }],
    chatType: "individual",
  });
  try {
    // releaseUncapturedSeatClaim reads the chat through findById (no .select) for 1:1.
    GroupChat.findById = async () => ({
      _id: CHAT_ID,
      type: "individual",
      status: "active",
      admin: EXPERT_ID,
    });

    const outcome = await groupController.handleBookingPaymentIntentEvent(
      bookingEvent("payment_intent.canceled"),
    );

    assert.equal(outcome, "failed_rolled_back");
    const cancelled = (calls.groupUpdateOne || []).some(
      ([, update]: any[]) => update?.$set?.status === "cancelled",
    );
    assert.ok(cancelled, "an unpaid 1:1 session must be cancelled, not left active");
  } finally {
    restore();
  }
});

test("a failed payment with nothing pending is a no-op", async () => {
  resetCalls();
  const restore = withWebhookModels({ pendingRows: [] });
  try {
    const outcome = await groupController.handleBookingPaymentIntentEvent(
      bookingEvent("payment_intent.payment_failed", { metadata: { groupChatId: undefined } }),
    );
    assert.equal(outcome, "failed_noop");
    assert.equal(calls.historyUpdateOne, undefined);
  } finally {
    restore();
  }
});
