import test from "node:test";
import assert from "node:assert/strict";

const order: string[] = [];
const sentEmails: any[] = [];

// Stripe stands in before anything loads it: processRefund builds a client on every call.
const stripePath = require.resolve("stripe");
require.cache[stripePath] = {
  id: stripePath,
  filename: stripePath,
  loaded: true,
  exports: () => ({
    refunds: {
      create: async (data: any) => {
        order.push("stripe refund");
        return { id: "re_test", payment_intent: data.payment_intent };
      },
    },
    paymentIntents: { retrieve: async () => ({}) },
  }),
} as any;

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey = () => {};
sgMail.send = async (msg: any) => {
  sentEmails.push(msg);
};

const AdminAuditLog = require("../models/AdminAuditLog");
const audits: any[] = [];
AdminAuditLog.create = async (doc: any) => {
  audits.push(doc);
  return doc;
};

const stripeController = require("../controllers/stripe.controller");
const groupController = require("../controllers/groupChat.controller");
const PaymentHistory = require("../models/PaymentHistory");
const AppState = require("../models/AppState");

const CHAT_ID = "ddddddddddddddddddddddd4";

const chargeDoc = () => ({
  _id: "fffffffffffffffffffffff7",
  paymentType: "charge",
  status: "completed",
  amount: 2500,
  currency: "usd",
  stripeMode: "test",
  paymentIntent: "pi_paid",
  description: "Weekly Visa Clinic",
  customer: { _id: "aaaaaaaaaaaaaaaaaaaaaaa1", email: "student@test.com", username: "Student" },
  expert: { _id: "bbbbbbbbbbbbbbbbbbbbbbb2", email: "expert@test.com", username: "Expert" },
  groupChat: CHAT_ID,
});

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
});

const original = {
  findById: PaymentHistory.findById,
  find: PaymentHistory.find,
  save: PaymentHistory.prototype.save,
  appState: AppState.findOne,
  release: groupController.releaseSeatAfterAdminRefund,
};

let releaseImpl: (payment: any) => Promise<any> = async () => ({ released: false });
const released: any[] = [];

const setup = () => {
  order.length = 0;
  sentEmails.length = 0;
  audits.length = 0;
  released.length = 0;
  PaymentHistory.findById = () => ({ populate: async () => chargeDoc() });
  PaymentHistory.find = () => ({ select: () => ({ lean: async () => [] }) });
  PaymentHistory.prototype.save = async function save() {
    order.push(`saved ${this.paymentType}`);
    return this;
  };
  AppState.findOne = async () => ({ stripeMode: "test" });
  groupController.releaseSeatAfterAdminRefund = async (payment: any) => {
    order.push("release seat");
    released.push(payment);
    return releaseImpl(payment);
  };
};

const restore = () => {
  PaymentHistory.findById = original.findById;
  PaymentHistory.find = original.find;
  PaymentHistory.prototype.save = original.save;
  AppState.findOne = original.appState;
  groupController.releaseSeatAfterAdminRefund = original.release;
};

const refund = async (amount = 25) => {
  const res = createRes();
  await stripeController.processRefund(
    { user: { userId: "admin", email: "admin@test.com" }, body: { paymentHistoryId: "fffffffffffffffffffffff7", refundAmount: amount, refundReason: "Student asked to cancel" } },
    res,
  );
  return res;
};

test("an admin refund releases the seat after the refund is recorded, and says so", async () => {
  setup();
  releaseImpl = async () => ({ released: true, type: "seminar", sessionName: "Weekly Visa Clinic" });
  try {
    const res = await refund();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, "SUCCESS");
    assert.equal(res.body.message, "Refund processed successfully. student@test.com was removed from “Weekly Visa Clinic”.");
    assert.deepEqual(order, ["stripe refund", "saved refund", "release seat"], "the refund row exists before the seat check runs");
    assert.equal(String(released[0].groupChat), CHAT_ID);
    assert.match(sentEmails[0].html, /your seat in <strong>Weekly Visa Clinic<\/strong> has been released/);
    assert.equal(audits[0].meta.seatReleased, true);
    assert.equal(audits[0].meta.groupChat, CHAT_ID);
  } finally {
    restore();
  }
});

test("a released 1:1 is described as cancelled in the student's refund email", async () => {
  setup();
  releaseImpl = async () => ({ released: true, type: "individual", sessionName: "Student & Expert" });
  try {
    await refund(10);
    assert.match(sentEmails[0].html, /your 1:1 session <strong>Student &amp; Expert<\/strong> has been cancelled/);
  } finally {
    restore();
  }
});

test("when nothing is released the refund reads as before", async () => {
  setup();
  releaseImpl = async () => ({ released: false, sessionName: "Weekly Visa Clinic", skipped: "ended" });
  try {
    const res = await refund();
    assert.equal(res.body.message, "Refund processed successfully.");
    assert.doesNotMatch(sentEmails[0].html, /Because of this refund/);
    assert.equal(audits[0].meta.seatReleased, false);
    assert.equal(audits[0].meta.seatReleaseSkipped, "ended");
  } finally {
    restore();
  }
});

test("a failed seat release never fails a refund that already went through", async () => {
  setup();
  releaseImpl = async () => {
    throw new Error("database unavailable");
  };
  try {
    const res = await refund();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, "SUCCESS");
    assert.equal(res.body.message, "Refund processed successfully.");
    assert.equal(sentEmails.length, 1, "the student still gets the refund email");
  } finally {
    restore();
  }
});
