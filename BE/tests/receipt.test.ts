import test from "node:test";
import assert from "node:assert/strict";

// Patched before receipt.controller is loaded, because it destructures this export
// at module scope.
const stripeController = require("../controllers/stripe.controller");
let intentStub: any = false;
stripeController.checkPaymentIntentSucceeded = async () => intentStub;

const receiptController = require("../controllers/receipt.controller");
const PaymentHistory = require("../models/PaymentHistory");

const createRes = () => {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const PAYMENT_ID = "b".repeat(24);

const row = () => ({
  _id: PAYMENT_ID,
  amount: 10000,
  currency: "usd",
  status: "completed",
  description: 'WisdomLinked 1:1 Session — "Research Methods" with Dr Bruce Wang',
  paymentIntent: "pi_test_123",
  stripeMode: "test",
  receiptUrl: "https://pay.stripe.com/receipts/payment/abc",
  receiptNumber: "2381-4472",
  balanceTransaction: "txn_1",
  createdAt: new Date("2026-06-22T03:47:00Z"),
  customer: { _id: "student-1", username: "Araavind", email: "araavind@student.edu" },
  expert: { _id: "expert-1", username: "Dr. Bruce Wang", title: "Professor of Molecular Biology" },
  groupChat: { name: "Research Methods & Grad School Guidance", type: "individual", duration: 45, start: new Date("2026-07-24T16:00:00Z") },
  event: null,
});

/** findById(...).populate(...).populate(...) — chainable and awaitable. */
const chain = (value: any) => {
  const obj: any = {
    populate: () => obj,
    then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject),
  };
  return obj;
};

const withRow = async (value: any, run: () => Promise<void>) => {
  const originalFindById = PaymentHistory.findById;
  const originalUpdateOne = PaymentHistory.updateOne;
  try {
    PaymentHistory.findById = () => chain(value);
    PaymentHistory.updateOne = async () => ({});
    await run();
  } finally {
    PaymentHistory.findById = originalFindById;
    PaymentHistory.updateOne = originalUpdateOne;
    intentStub = false;
  }
};

const call = async (userId: string, role = "customer", paymentId = PAYMENT_ID) => {
  const res = createRes();
  await receiptController.getReceipt({ user: { userId, role }, params: { paymentId } }, res);
  return res;
};

test("the student who paid can open their receipt", async () => {
  await withRow(row(), async () => {
    const res = await call("student-1");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.receipt.amount, 10000);
    assert.equal(res.body.receipt.receiptNumber, "2381-4472");
  });
});

test("the expert on the session can open it too", async () => {
  await withRow(row(), async () => {
    const res = await call("expert-1", "expert");
    assert.equal(res.statusCode, 200);
  });
});

test("an admin can open any receipt", async () => {
  await withRow(row(), async () => {
    const res = await call("someone-else", "admin");
    assert.equal(res.statusCode, 200);
  });
});

test("someone else's receipt is refused, not rendered", async () => {
  await withRow(row(), async () => {
    const res = await call("stranger-1");
    assert.equal(res.statusCode, 403);
    assert.match(String(res.body), /belongs to someone else/i);
  });
});

test("a missing receipt is a 404 and a malformed id is a 400", async () => {
  await withRow(null, async () => {
    const missing = await call("student-1");
    assert.equal(missing.statusCode, 404);
  });
  await withRow(row(), async () => {
    const malformed = await call("student-1", "customer", "123");
    assert.equal(malformed.statusCode, 400);
  });
});

test("the session block is shaped for the page", async () => {
  await withRow(row(), async () => {
    const res = await call("student-1");
    const r = res.body.receipt;
    assert.equal(r.session.name, "Research Methods & Grad School Guidance");
    assert.equal(r.session.typeLabel, "1:1 Session", "'individual' is spelled out for the reader");
    assert.equal(r.session.durationMinutes, 45);
    assert.equal(r.expert.title, "Professor of Molecular Biology");
    assert.equal(r.student.email, "araavind@student.edu");
    assert.equal(r.stripeReceiptUrl, "https://pay.stripe.com/receipts/payment/abc");
  });
});

test("the card brand comes off the live charge and is cached back onto the row", async () => {
  const saved: any[] = [];
  const originalFindById = PaymentHistory.findById;
  const originalUpdateOne = PaymentHistory.updateOne;
  try {
    PaymentHistory.findById = () => chain(row());
    PaymentHistory.updateOne = async (_q: any, update: any) => {
      saved.push(update);
      return {};
    };
    intentStub = {
      payment_method_types: ["card"],
      latest_charge: { payment_method_details: { card: { brand: "visa", last4: "4242" } } },
    };

    const res = await call("student-1");
    assert.deepEqual(res.body.receipt.card, { brand: "visa", last4: "4242" });
    assert.equal(res.body.receipt.paymentMethod, "Credit card");
    assert.equal(saved.length, 1, "the lookup is cached so the next view needs no Stripe call");
    assert.deepEqual(saved[0].$set, { cardBrand: "visa", cardLast4: "4242" });
  } finally {
    PaymentHistory.findById = originalFindById;
    PaymentHistory.updateOne = originalUpdateOne;
    intentStub = false;
  }
});

test("a stored card is used as-is and is not written back again", async () => {
  const saved: any[] = [];
  const originalFindById = PaymentHistory.findById;
  const originalUpdateOne = PaymentHistory.updateOne;
  try {
    PaymentHistory.findById = () => chain({ ...row(), cardBrand: "mastercard", cardLast4: "4444" });
    PaymentHistory.updateOne = async (_q: any, update: any) => {
      saved.push(update);
      return {};
    };
    intentStub = {
      payment_method_types: ["card"],
      latest_charge: { payment_method_details: { card: { brand: "visa", last4: "4242" } } },
    };

    const res = await call("student-1");
    assert.deepEqual(res.body.receipt.card, { brand: "mastercard", last4: "4444" }, "the stored value wins");
    assert.equal(res.body.receipt.paymentMethod, "Credit card");
    assert.equal(saved.length, 0, "nothing is rewritten once the row already has a card");
  } finally {
    PaymentHistory.findById = originalFindById;
    PaymentHistory.updateOne = originalUpdateOne;
    intentStub = false;
  }
});

test("a wallet payment renders without a card", async () => {
  await withRow(row(), async () => {
    intentStub = { payment_method_types: ["wechat_pay"] };
    const res = await call("student-1");
    assert.equal(res.body.receipt.card, null);
    assert.equal(res.body.receipt.paymentMethod, "WeChat Pay");
  });
});

test("a receipt still renders when Stripe cannot be reached", async () => {
  await withRow(row(), async () => {
    intentStub = false;
    const res = await call("student-1");
    assert.equal(res.statusCode, 200, "presentation detail must never fail the page");
    assert.equal(res.body.receipt.card, null);
    assert.equal(res.body.receipt.amount, 10000);
  });
});

test("a refunded payment keeps its status so the page can say so", async () => {
  await withRow({ ...row(), status: "refunded" }, async () => {
    const res = await call("student-1");
    assert.equal(res.body.receipt.status, "refunded");
    assert.equal(res.body.receipt.paymentType, "charge", "the page needs this to date a refund correctly");
  });
});

test("a refund row is reported as a refund, not as a charge", async () => {
  await withRow({ ...row(), status: "refunded", paymentType: "refund" }, async () => {
    const res = await call("student-1");
    assert.equal(res.body.receipt.paymentType, "refund");
  });
});
