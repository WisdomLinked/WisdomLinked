import test from "node:test";
import assert from "node:assert/strict";

const notifications = require("../services/notifications");

const calls: Record<string, any[]> = {};
const record = (name: string, args: any[]) => {
  calls[name] = calls[name] || [];
  calls[name].push(args);
};
notifications.sendNotificationEmail = async (to: string, subject: string) => {
  record("email", [to, subject]);
};

const groupController = require("../controllers/groupChat.controller");
const User = require("../models/User");
const GroupChat = require("../models/GroupChat");
const PaymentHistory = require("../models/PaymentHistory");

const STUDENT_ID = "aaaaaaaaaaaaaaaaaaaaaaa1";
const EXPERT_ID = "bbbbbbbbbbbbbbbbbbbbbbb2";
const CHAT_ID = "ddddddddddddddddddddddd4";
const NEXT_DATE_ID = "ddddddddddddddddddddddd5";
const SERIES_ID = "eeeeeeeeeeeeeeeeeeeeeee6";
const REFUNDED_INTENT = "pi_refunded_by_admin";

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

const oneToOne = (overrides: any = {}) => ({
  _id: CHAT_ID,
  name: "Student & Expert",
  type: "individual",
  status: "active",
  start: hoursFromNow(24),
  end: hoursFromNow(25),
  admin: EXPERT_ID,
  createdBy: STUDENT_ID,
  participants: [STUDENT_ID, EXPERT_ID],
  ...overrides,
});

const seminarDate = (id: string, startHours: number, overrides: any = {}) => ({
  _id: id,
  name: "Weekly Visa Clinic",
  type: "seminar",
  status: "active",
  start: hoursFromNow(startHours),
  end: hoursFromNow(startHours + 1),
  admin: EXPERT_ID,
  participants: [STUDENT_ID],
  seriesId: SERIES_ID,
  ...overrides,
});

const charge = (overrides: any = {}) => ({
  paymentType: "charge",
  status: "completed",
  paymentIntent: REFUNDED_INTENT,
  customer: STUDENT_ID,
  groupChat: CHAT_ID,
  ...overrides,
});

const refund = (overrides: any = {}) => ({
  paymentType: "refund",
  status: "refunded",
  paymentIntent: REFUNDED_INTENT,
  customer: STUDENT_ID,
  groupChat: CHAT_ID,
  ...overrides,
});

const matchesPaymentQuery = (row: any, query: any) => {
  if (query.customer && String(row.customer) !== String(query.customer)) return false;
  if (query.groupChat?.$in && !query.groupChat.$in.map(String).includes(String(row.groupChat))) return false;
  if (query.paymentType && row.paymentType !== query.paymentType) return false;
  if (query.paymentIntent?.$in && !query.paymentIntent.$in.includes(row.paymentIntent)) return false;
  if (query.$or) {
    return query.$or.some((branch: any) => {
      if (row.paymentType !== branch.paymentType) return false;
      const statuses = branch.status?.$in || [branch.status];
      return statuses.includes(row.status);
    });
  }
  return true;
};

/** chat: what findById(payment.groupChat) returns; dates: what the series lookup returns. */
const withModels = ({ chat, dates = [] as any[], payments = [] as any[] }: any) => {
  const original = {
    findById: GroupChat.findById,
    find: GroupChat.find,
    findOneAndUpdate: GroupChat.findOneAndUpdate,
    updateMany: GroupChat.updateMany,
    userFindById: User.findById,
    userUpdateOne: User.updateOne,
    historyFind: PaymentHistory.find,
    historyDistinct: PaymentHistory.distinct,
  };

  GroupChat.findById = (id: any) => {
    record("groupFindById", [String(id)]);
    const value = String(id) === String(chat?._id) ? chat : dates.find((d: any) => String(d._id) === String(id)) || null;
    // The waitlist path awaits findById directly; a closed seminar ends its loop at once.
    const waitlistView = value ? { ...value, status: "cancelled" } : null;
    return {
      select: async () => value,
      then: (resolve: any, reject: any) => Promise.resolve(waitlistView).then(resolve, reject),
    };
  };
  GroupChat.find = () => ({ select: async () => dates });
  GroupChat.findOneAndUpdate = async (filter: any, update: any) => {
    record("groupFindOneAndUpdate", [filter, update]);
    return chat?.status === "cancelled" ? null : chat;
  };
  GroupChat.updateMany = async (filter: any, update: any) => {
    record("groupUpdateMany", [filter, update]);
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
  PaymentHistory.find = (query: any) => ({
    select: async () => payments.filter((row: any) => matchesPaymentQuery(row, query)),
  });
  PaymentHistory.distinct = async (field: string, query: any) =>
    payments.filter((row: any) => matchesPaymentQuery(row, query)).map((row: any) => row[field]);

  return () => {
    GroupChat.findById = original.findById;
    GroupChat.find = original.find;
    GroupChat.findOneAndUpdate = original.findOneAndUpdate;
    GroupChat.updateMany = original.updateMany;
    User.findById = original.userFindById;
    User.updateOne = original.userUpdateOne;
    PaymentHistory.find = original.historyFind;
    PaymentHistory.distinct = original.historyDistinct;
  };
};

const reset = () => {
  for (const key of Object.keys(calls)) delete calls[key];
};

const refundedPayment = (overrides: any = {}) => ({
  _id: "fffffffffffffffffffffff7",
  customer: { _id: STUDENT_ID, email: "student@test.com" },
  groupChat: CHAT_ID,
  paymentIntent: REFUNDED_INTENT,
  ...overrides,
});

const cancelled = () => (calls.groupFindOneAndUpdate || []).find(
  ([, update]: any[]) => update?.$set?.status === "cancelled",
);

test("a refunded upcoming 1:1 is cancelled and the expert is told", async () => {
  reset();
  const restore = withModels({ chat: oneToOne(), payments: [charge(), refund()] });
  try {
    const result = await groupController.releaseSeatAfterAdminRefund(refundedPayment());
    assert.deepEqual(result, { released: true, type: "individual", sessionName: "Student & Expert" });
    const [filter, update] = cancelled();
    assert.deepEqual(filter.status, { $ne: "cancelled" });
    assert.equal(update.$set.paymentDeadline, null);
    assert.deepEqual((calls.email || []).map(([to]: any[]) => to), ["expert@test.com"]);
  } finally {
    restore();
  }
});

test("a partial refund releases the seat too", async () => {
  reset();
  const restore = withModels({
    chat: oneToOne(),
    payments: [charge(), refund({ status: "completed" })],
  });
  try {
    const result = await groupController.releaseSeatAfterAdminRefund(refundedPayment());
    assert.equal(result.released, true);
  } finally {
    restore();
  }
});

test("a live 1:1 that has started but not ended is still released", async () => {
  reset();
  const restore = withModels({
    chat: oneToOne({ start: hoursFromNow(-0.25), end: hoursFromNow(0.75) }),
    payments: [charge(), refund()],
  });
  try {
    assert.equal((await groupController.releaseSeatAfterAdminRefund(refundedPayment())).released, true);
  } finally {
    restore();
  }
});

test("a 1:1 that has ended stays as history", async () => {
  reset();
  const restore = withModels({
    chat: oneToOne({ start: hoursFromNow(-3), end: hoursFromNow(-2) }),
    payments: [charge(), refund()],
  });
  try {
    const result = await groupController.releaseSeatAfterAdminRefund(refundedPayment());
    assert.equal(result.skipped, "ended");
    assert.equal(cancelled(), undefined);
    assert.equal(calls.email, undefined);
  } finally {
    restore();
  }
});

test("a 1:1 already cancelled is left alone", async () => {
  reset();
  const restore = withModels({ chat: oneToOne({ status: "cancelled" }), payments: [charge(), refund()] });
  try {
    const result = await groupController.releaseSeatAfterAdminRefund(refundedPayment());
    assert.equal(result.skipped, "already_cancelled");
    assert.equal(cancelled(), undefined);
  } finally {
    restore();
  }
});

test("a student who still has another unrefunded payment keeps the 1:1", async () => {
  reset();
  const restore = withModels({
    chat: oneToOne(),
    payments: [charge(), refund(), charge({ paymentIntent: "pi_second_payment" })],
  });
  try {
    const result = await groupController.releaseSeatAfterAdminRefund(refundedPayment());
    assert.equal(result.skipped, "still_paid");
    assert.equal(cancelled(), undefined);
  } finally {
    restore();
  }
});

test("a completed retry payment counts as paid, an unpaid retry link does not", async () => {
  reset();
  let restore = withModels({
    chat: oneToOne(),
    payments: [charge(), refund(), { ...charge({ paymentIntent: "pi_retry" }), paymentType: "retry" }],
  });
  try {
    assert.equal((await groupController.releaseSeatAfterAdminRefund(refundedPayment())).skipped, "still_paid");
  } finally {
    restore();
  }
  reset();
  restore = withModels({
    chat: oneToOne(),
    payments: [charge(), refund(), { ...charge({ paymentIntent: undefined, status: "pending" }), paymentType: "retry" }],
  });
  try {
    assert.equal((await groupController.releaseSeatAfterAdminRefund(refundedPayment())).released, true);
  } finally {
    restore();
  }
});

test("a payment with no session, or for someone not on it, releases nothing", async () => {
  reset();
  const restore = withModels({ chat: oneToOne({ participants: [EXPERT_ID] }), payments: [charge(), refund()] });
  try {
    assert.equal((await groupController.releaseSeatAfterAdminRefund(refundedPayment({ groupChat: null }))).skipped, "no_session");
    assert.equal((await groupController.releaseSeatAfterAdminRefund(refundedPayment())).skipped, "not_enrolled");
    assert.equal(cancelled(), undefined);
  } finally {
    restore();
  }
});

test("a refunded seminar student leaves the whole series and the next open date is offered", async () => {
  reset();
  const pastDate = seminarDate(CHAT_ID, -48);
  const nextDate = seminarDate(NEXT_DATE_ID, 72);
  const restore = withModels({
    chat: pastDate,
    dates: [pastDate, nextDate],
    payments: [charge(), refund()],
  });
  try {
    const result = await groupController.releaseSeatAfterAdminRefund(refundedPayment());
    assert.deepEqual(result, { released: true, type: "seminar", sessionName: "Weekly Visa Clinic" });
    const [filter, update] = (calls.groupUpdateMany || [])[0];
    assert.deepEqual(filter._id.$in.map(String), [CHAT_ID, NEXT_DATE_ID], "every date, as when leaving");
    assert.deepEqual(update, { $pull: { participants: STUDENT_ID } });
    assert.ok((calls.userUpdateOne || []).length, "the dates leave the student's list too");
    assert.ok((calls.groupFindById || []).some(([id]: any[]) => id === NEXT_DATE_ID), "the next open date is offered to the waitlist");
    assert.deepEqual((calls.email || []).map(([to]: any[]) => to), ["expert@test.com"], "the host is told");
  } finally {
    restore();
  }
});

test("a seminar whose dates have all ended stays as history", async () => {
  reset();
  const pastDate = seminarDate(CHAT_ID, -48);
  const restore = withModels({ chat: pastDate, dates: [pastDate], payments: [charge(), refund()] });
  try {
    const result = await groupController.releaseSeatAfterAdminRefund(refundedPayment());
    assert.equal(result.skipped, "ended");
    assert.equal(calls.groupUpdateMany, undefined);
  } finally {
    restore();
  }
});

test("a seminar paid for on another date of the series keeps the seat", async () => {
  reset();
  const date = seminarDate(CHAT_ID, 24);
  const restore = withModels({
    chat: date,
    dates: [date, seminarDate(NEXT_DATE_ID, 96)],
    payments: [charge(), refund(), charge({ paymentIntent: "pi_other_date", groupChat: NEXT_DATE_ID })],
  });
  try {
    assert.equal((await groupController.releaseSeatAfterAdminRefund(refundedPayment())).skipped, "still_paid");
    assert.equal(calls.groupUpdateMany, undefined);
  } finally {
    restore();
  }
});
