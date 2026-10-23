import test, { after } from "node:test";
import assert from "node:assert/strict";
import { payrollLiveNetCents } from "../utils/expertPayroll";

const PaymentHistory = require("../models/PaymentHistory");
const PayrollCheque = require("../models/PayrollCheque");
const User = require("../models/User");
const AppState = require("../models/AppState");
const payroll = require("../controllers/payroll.controller");
const adminRoutes = require("../routes/adminRoutes");
const { adminAuth } = require("../middlewares/requireAuth");
const sgMail = require("@sendgrid/mail");

type SentMail = { to?: unknown; from?: { email?: string }; subject?: string; html?: string };

const sentMails: SentMail[] = [];
const originalSgSend = sgMail.send;
const recordSend = async (msg: SentMail) => {
  sentMails.push(msg);
  return [{ statusCode: 202 }];
};
sgMail.send = recordSend;
after(() => {
  sgMail.send = originalSgSend;
});

const EXPERT = "507f1f77bcf86cd799439011";
const ADMIN = "507f1f77bcf86cd799439012";

type Charge = {
  expert: string;
  amount: number;
  status: string;
  paymentType: string;
  createdAt: string;
  paymentIntent?: string;
};

type Cheque = {
  _id: string;
  expert: string;
  year: number;
  month: number;
  amountCents: number;
  chequeNumber: string;
  chequeDate: Date;
  recordedBy: string;
};

let charges: Charge[] = [];
let cheques: Cheque[] = [];
let seq = 1;

const originals = {
  historyFind: PaymentHistory.find,
  chequeFind: PayrollCheque.find,
  chequeFindOne: PayrollCheque.findOne,
  chequeCreate: PayrollCheque.create,
  chequeUpdate: PayrollCheque.findByIdAndUpdate,
  userFind: User.find,
  appFind: AppState.findOne,
};

const matchesCharge = (row: Charge, filter: any) => {
  if (typeof filter?.status === "string" && row.status !== filter.status) return false;
  if (Array.isArray(filter?.status?.$in) && !filter.status.$in.includes(row.status)) return false;
  if (filter?.paymentType?.$ne && row.paymentType === filter.paymentType.$ne) return false;
  if (typeof filter?.paymentType === "string" && row.paymentType !== filter.paymentType) return false;
  if (Array.isArray(filter?.paymentIntent?.$in) && !filter.paymentIntent.$in.includes(row.paymentIntent)) return false;
  if (typeof filter?.expert === "string" && String(row.expert) !== filter.expert) return false;
  if (filter?.expert && typeof filter.expert === "object" && row.expert == null) return false;
  const created = new Date(row.createdAt).getTime();
  if (filter?.createdAt?.$gte && created < new Date(filter.createdAt.$gte).getTime()) return false;
  if (filter?.createdAt?.$lt && created >= new Date(filter.createdAt.$lt).getTime()) return false;
  return true;
};

const install = () => {
  PaymentHistory.find = (filter: any) => ({
    lean: async () => charges.filter((row) => matchesCharge(row, filter)),
  });
  PayrollCheque.find = (filter: any) => ({
    lean: async () => cheques.filter((row) => {
      if (filter?.year != null && row.year !== Number(filter.year)) return false;
      if (filter?.month != null && row.month !== Number(filter.month)) return false;
      if (filter?.expert && String(row.expert) !== String(filter.expert)) return false;
      return true;
    }),
  });
  PayrollCheque.findOne = async (filter: any) => cheques.find((row) => (
    String(row.expert) === String(filter.expert)
    && row.year === Number(filter.year)
    && row.month === Number(filter.month)
  )) || null;
  PayrollCheque.create = async (doc: any) => {
    const duplicate = cheques.some((row) => (
      String(row.expert) === String(doc.expert) && row.year === doc.year && row.month === doc.month
    ));
    if (duplicate) {
      const error: any = new Error("duplicate");
      error.code = 11000;
      throw error;
    }
    const saved = { ...doc, _id: `cheque-${seq}` };
    seq += 1;
    cheques.push(saved);
    return saved;
  };
  PayrollCheque.findByIdAndUpdate = async (id: string, update: any) => {
    const row = cheques.find((cheque) => cheque._id === String(id));
    if (!row) return null;
    Object.assign(row, update?.$set || {});
    return row;
  };
  User.find = () => ({
    select() { return this; },
    lean: async () => [{ _id: EXPERT, username: "Ada Expert", email: "ada@example.com" }],
  });
  AppState.findOne = async () => ({ stripeMode: "test" });
};

const restore = () => {
  PaymentHistory.find = originals.historyFind;
  PayrollCheque.find = originals.chequeFind;
  PayrollCheque.findOne = originals.chequeFindOne;
  PayrollCheque.create = originals.chequeCreate;
  PayrollCheque.findByIdAndUpdate = originals.chequeUpdate;
  User.find = originals.userFind;
  AppState.findOne = originals.appFind;
};

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
  };
  return res;
};

const marchCharge = (overrides: Partial<Charge> = {}): Charge => ({
  expert: EXPERT,
  amount: 1000,
  status: "completed",
  paymentType: "charge",
  createdAt: "2026-03-15T18:00:00.000Z",
  ...overrides,
});

test("a completed $10 old row is an $8 cheque and other statuses are not", () => {
  const rows = [
    marchCharge(),
    marchCharge({ status: "pending" }),
    marchCharge({ status: "failed", amount: 2500 }),
    marchCharge({ status: "released" }),
    marchCharge({ status: "refunded" }),
    marchCharge({ status: "withheld" }),
    marchCharge({ paymentType: "refund", status: "completed", amount: 1000 }),
    marchCharge({ createdAt: "2026-04-01T00:00:00.000Z" }),
    marchCharge({ createdAt: "2026-02-28T23:00:00.000Z" }),
  ];
  const income = rows.filter((row) => row.createdAt.startsWith("2026-03") && row.paymentType !== "refund");
  assert.equal(payrollLiveNetCents(income), 800);

  const charge = marchCharge({ paymentIntent: "pi_mar" });
  const partialRefund = marchCharge({
    paymentType: "refund",
    status: "completed",
    amount: 500,
    paymentIntent: "pi_mar",
    createdAt: "2026-04-10T00:00:00.000Z",
  });
  assert.equal(payrollLiveNetCents([charge, partialRefund]), 400);
  assert.equal(payrollLiveNetCents([
    marchCharge({ status: "refunded", paymentIntent: "pi_mar" }),
    marchCharge({ paymentType: "refund", status: "refunded", amount: 1000, paymentIntent: "pi_mar" }),
  ]), 0);
});

test("a refunded seminar washes a refund row that has no session type", () => {
  const groupChatId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const refundedSeminar = {
    status: "refunded",
    paymentType: "charge",
    amount: 10000,
    expertNetCents: 8000,
    sessionType: "seminar",
    paymentIntent: "pi_left",
    groupChat: groupChatId,
    createdAt: "2026-03-04T00:00:00.000Z",
  };
  const refundRow = {
    status: "refunded",
    paymentType: "refund",
    amount: 10000,
    paymentIntent: "pi_left",
    groupChat: groupChatId,
    createdAt: "2026-03-05T00:00:00.000Z",
  };
  const otherSeminar = {
    status: "completed",
    paymentType: "charge",
    amount: 10000,
    expertNetCents: 8000,
    sessionType: "seminar",
    paymentIntent: "pi_kept",
    groupChat: groupChatId,
    createdAt: "2026-03-12T00:00:00.000Z",
  };
  const pending = {
    status: "pending",
    paymentType: "charge",
    amount: 10000,
    expertNetCents: 8000,
    sessionType: "seminar",
    paymentIntent: "pi_wait",
    createdAt: "2026-03-18T00:00:00.000Z",
  };

  assert.equal(payrollLiveNetCents([refundedSeminar, refundRow]), 0);
  assert.equal(payrollLiveNetCents([refundedSeminar, refundRow, otherSeminar, pending]), 8000);
});

test("payroll records one cheque per expert per UTC month and ignores a client amount", async (t) => {
  install();
  t.after(restore);
  charges = [
    marchCharge(),
    marchCharge({ status: "pending" }),
    marchCharge({ status: "failed", amount: 5000 }),
  ];
  cheques = [];
  seq = 1;

  const listed = createRes();
  await payroll.listPayroll({ query: { year: "2026", month: "3" } }, listed);
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.timeZone, "UTC");
  assert.equal(listed.body.rows.length, 1);
  assert.equal(listed.body.rows[0].liveNetCents, 800);
  assert.equal(listed.body.rows[0].status, "unpaid");

  const empty = createRes();
  await payroll.recordPayrollCheque({
    user: { userId: ADMIN },
    body: {
      expertId: EXPERT,
      year: 2026,
      month: 3,
      chequeNumber: " ",
      chequeDate: "2026-03-31",
      amountCents: 1,
    },
  }, empty);
  assert.equal(empty.statusCode, 400);
  assert.equal(cheques.length, 0);

  const recorded = createRes();
  await payroll.recordPayrollCheque({
    user: { userId: ADMIN },
    body: {
      expertId: EXPERT,
      year: 2026,
      month: 3,
      chequeNumber: "  1001 ",
      chequeDate: "2026-03-31",
      amountCents: 1,
    },
  }, recorded);
  assert.equal(recorded.statusCode, 201);
  assert.equal(recorded.body.amountCents, 800);
  assert.equal(cheques[0].amountCents, 800);
  assert.equal(cheques[0].chequeNumber, "1001");
  assert.equal(String(cheques[0].recordedBy), ADMIN);

  const duplicate = createRes();
  await payroll.recordPayrollCheque({
    user: { userId: ADMIN },
    body: {
      expertId: EXPERT,
      year: 2026,
      month: 3,
      chequeNumber: "1002",
      chequeDate: "2026-03-31",
      amountCents: 800,
    },
  }, duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.equal(cheques.length, 1);
  assert.equal(cheques[0].amountCents, 800);

  const corrected = createRes();
  await payroll.updatePayrollCheque({
    params: { id: cheques[0]._id },
    body: { chequeNumber: "  2002 ", chequeDate: "2026-04-02", amountCents: 1 },
  }, corrected);
  assert.equal(corrected.statusCode, 200);
  assert.equal(cheques[0].chequeNumber, "2002");
  assert.equal(cheques[0].amountCents, 800);
  assert.equal(corrected.body.amountCents, 800);

  charges[0].status = "refunded";
  const afterRefund = createRes();
  await payroll.listPayroll({ query: { year: 2026, month: 3 } }, afterRefund);
  assert.equal(afterRefund.body.rows.length, 1);
  assert.equal(afterRefund.body.rows[0].liveNetCents, 0);
  assert.equal(afterRefund.body.rows[0].cheque.amountCents, 800);
  assert.equal(cheques[0].amountCents, 800);
  assert.ok(afterRefund.body.rows[0].liveNetCents < cheques[0].amountCents);

  const nothing = createRes();
  charges = [marchCharge({ status: "pending", createdAt: "2026-05-02T00:00:00.000Z" })];
  await payroll.recordPayrollCheque({
    user: { userId: ADMIN },
    body: {
      expertId: EXPERT,
      year: 2026,
      month: 5,
      chequeNumber: "3003",
      chequeDate: "2026-05-31",
    },
  }, nothing);
  assert.equal(nothing.statusCode, 400);
  assert.equal(cheques.length, 1);
});

test("a refund row lowers live net and leaves the cheque amount", async (t) => {
  install();
  t.after(restore);
  charges = [marchCharge({ paymentIntent: "pi_mar" })];
  cheques = [];
  seq = 1;

  const recorded = createRes();
  await payroll.recordPayrollCheque({
    user: { userId: ADMIN },
    body: {
      expertId: EXPERT,
      year: 2026,
      month: 3,
      chequeNumber: "1001",
      chequeDate: "2026-03-31",
      amountCents: 1,
    },
  }, recorded);
  assert.equal(recorded.statusCode, 201);
  assert.equal(cheques[0].amountCents, 800);

  // processRefund leaves the charge completed and writes a later refund row.
  // Half of the $10 charge is $5; the expert share of that refund is $4.
  charges.push(marchCharge({
    paymentType: "refund",
    status: "completed",
    amount: 500,
    paymentIntent: "pi_mar",
    createdAt: "2026-04-10T00:00:00.000Z",
  }));
  assert.equal(charges[0].status, "completed");

  const listed = createRes();
  await payroll.listPayroll({ query: { year: 2026, month: 3 } }, listed);
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.rows.length, 1);
  assert.equal(listed.body.rows[0].liveNetCents, 400);
  assert.equal(800 - listed.body.rows[0].liveNetCents, 400);
  assert.equal(listed.body.rows[0].differenceCents, -400);
  assert.equal(listed.body.rows[0].cheque.amountCents, 800);
  assert.equal(cheques[0].amountCents, 800);
});

test("recording a cheque emails the expert once and updating it does not", async (t) => {
  install();
  t.after(restore);
  sentMails.length = 0;
  charges = [marchCharge({ createdAt: "2026-10-15T18:00:00.000Z" })];
  cheques = [];
  seq = 1;
  sgMail.send = recordSend;

  const recorded = createRes();
  await payroll.recordPayrollCheque({
    user: { userId: ADMIN },
    body: {
      expertId: EXPERT,
      year: 2026,
      month: 10,
      chequeNumber: "  1001 ",
      chequeDate: "2026-10-31",
      amountCents: 1,
    },
  }, recorded);
  assert.equal(recorded.statusCode, 201);
  assert.equal(recorded.body.amountCents, 800);
  assert.equal(recorded.body.emailSent, true);
  assert.equal(recorded.body.emailStatus, "sent");
  assert.equal(cheques.length, 1);
  assert.equal(sentMails.length, 1);
  const mail = sentMails[0];
  assert.equal(mail.subject, "Your WisdomLinked payout has been processed");
  assert.deepEqual(mail.to, ["ada@example.com"]);
  assert.equal(mail.from?.email, "noreply@wisdomlinked.com");
  assert.match(mail.html || "", /1001/);
  assert.match(mail.html || "", /\$8\.00/);
  assert.match(mail.html || "", /October 2026/);
  assert.match(mail.html || "", /Ada Expert/);
  assert.match(mail.html || "", /expertdashboard/);
  assert.doesNotMatch(mail.html || "", /platform fee/i);

  const corrected = createRes();
  await payroll.updatePayrollCheque({
    params: { id: cheques[0]._id },
    body: { chequeNumber: "2002", chequeDate: "2026-11-02" },
  }, corrected);
  assert.equal(corrected.statusCode, 200);
  assert.equal(cheques[0].chequeNumber, "2002");
  assert.equal(cheques[0].amountCents, 800);
  assert.equal(sentMails.length, 1);
});

test("a cheque is kept when the payout email cannot be sent", async (t) => {
  install();
  t.after(() => {
    sgMail.send = recordSend;
    restore();
  });
  sentMails.length = 0;
  charges = [marchCharge()];
  cheques = [];
  seq = 1;
  sgMail.send = async () => {
    throw new Error("SendGrid is down");
  };

  const recorded = createRes();
  await payroll.recordPayrollCheque({
    user: { userId: ADMIN },
    body: {
      expertId: EXPERT,
      year: 2026,
      month: 3,
      chequeNumber: "1001",
      chequeDate: "2026-03-31",
    },
  }, recorded);
  assert.equal(recorded.statusCode, 201);
  assert.equal(recorded.body.emailSent, false);
  assert.equal(recorded.body.emailStatus, "failed");
  assert.equal(cheques.length, 1);
  assert.equal(cheques[0].amountCents, 800);
  assert.equal(cheques[0].chequeNumber, "1001");
});

test("a cheque is kept when the expert has no email", async (t) => {
  install();
  t.after(restore);
  sentMails.length = 0;
  charges = [marchCharge()];
  cheques = [];
  seq = 1;
  sgMail.send = recordSend;
  User.find = () => ({
    select() { return this; },
    lean: async () => [{ _id: EXPERT, username: "Ada Expert", email: "  " }],
  });

  const recorded = createRes();
  await payroll.recordPayrollCheque({
    user: { userId: ADMIN },
    body: {
      expertId: EXPERT,
      year: 2026,
      month: 3,
      chequeNumber: "1001",
      chequeDate: "2026-03-31",
    },
  }, recorded);
  assert.equal(recorded.statusCode, 201);
  assert.equal(recorded.body.emailSent, false);
  assert.equal(recorded.body.emailStatus, "no_email");
  assert.equal(sentMails.length, 0);
  assert.equal(cheques.length, 1);
  assert.equal(cheques[0].chequeNumber, "1001");
});

test("a payroll month is unique per expert", () => {
  const indexes = PayrollCheque.schema.indexes();
  const unique = indexes.some(([fields, options]: [any, any]) => (
    fields.expert === 1 && fields.year === 1 && fields.month === 1 && options?.unique === true
  ));
  assert.equal(unique, true);
});

test("payroll routes require admin auth", async () => {
  const routes: Array<[string, string]> = [
    ["get", "/payroll"],
    ["post", "/payroll"],
    ["get", "/payroll/expert/:expertId"],
    ["patch", "/payroll/:id"],
  ];
  for (const [method, path] of routes) {
    const layer = adminRoutes.stack.find((entry: any) => (
      entry.route?.path === path && entry.route.methods?.[method]
    ));
    assert.ok(layer, `${method} ${path} is registered`);
    assert.equal(layer.route.stack[0].handle, adminAuth);
  }

  const layer = adminRoutes.stack.find((entry: any) => (
    entry.route?.path === "/payroll" && entry.route.methods?.get
  ));
  const res = createRes();
  let nextCalled = false;
  await layer.route.stack[0].handle({ headers: {}, cookies: {} }, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});
