import test from "node:test";
import assert from "node:assert/strict";

import {
  checkSeat,
  classifyBookingPayment,
  foldChargeRows,
  isActionable,
  markRefundedCharges,
  sessionHasEnded,
  summarizeVerdicts,
  recordCountsByStatus,
} from "../utils/paymentIntegrity";

test("a booking with no price owed is free, never unpaid", () => {
  assert.equal(
    classifyBookingPayment({
      priceCents: 0,
      hasCompletedCharge: false,
      hasPendingCharge: false,
      hasRefundedCharge: false,
    }),
    "free",
  );
});

test("access with a completed charge is paid", () => {
  assert.equal(
    classifyBookingPayment({
      priceCents: 10000,
      hasCompletedCharge: true,
      hasPendingCharge: false,
      hasRefundedCharge: false,
    }),
    "paid",
  );
});

test("access with no charge at all is the unpaid case the ticket is about", () => {
  assert.equal(
    classifyBookingPayment({
      priceCents: 10000,
      hasCompletedCharge: false,
      hasPendingCharge: false,
      hasRefundedCharge: false,
    }),
    "unpaid",
  );
});

test("a capture still in flight is not reported as unpaid", () => {
  assert.equal(
    classifyBookingPayment({
      priceCents: 10000,
      hasCompletedCharge: false,
      hasPendingCharge: true,
      hasRefundedCharge: false,
    }),
    "in_flight",
  );
});

test("refunded-but-still-enrolled is flagged separately from unpaid", () => {
  assert.equal(
    classifyBookingPayment({
      priceCents: 10000,
      hasCompletedCharge: false,
      hasPendingCharge: false,
      hasRefundedCharge: true,
    }),
    "refunded",
  );
});

test("a completed charge outranks a later partial-refund row", () => {
  const folded = foldChargeRows([{ status: "completed" }, { status: "refunded" }]);
  assert.deepEqual(folded, {
    hasCompletedCharge: true,
    hasPendingCharge: false,
    hasRefundedCharge: true,
    hasWithheldCharge: false,
  });
  assert.equal(classifyBookingPayment({ priceCents: 5000, ...folded }), "paid");
});

test("a held authorization awaiting the expert is not reported as unpaid", () => {
  const folded = foldChargeRows([{ status: "withheld" }]);
  assert.deepEqual(folded, {
    hasCompletedCharge: false,
    hasPendingCharge: false,
    hasRefundedCharge: false,
    hasWithheldCharge: true,
  });
  assert.equal(classifyBookingPayment({ priceCents: 10000, ...folded }), "withheld");
  assert.equal(isActionable("withheld"), false);
});

test("a captured charge outranks the withheld row it settled", () => {
  const folded = foldChargeRows([{ status: "withheld" }, { status: "completed" }]);
  assert.equal(classifyBookingPayment({ priceCents: 10000, ...folded }), "paid");
});

test("foldChargeRows tolerates no rows and junk rows", () => {
  assert.deepEqual(foldChargeRows([]), {
    hasCompletedCharge: false,
    hasPendingCharge: false,
    hasRefundedCharge: false,
    hasWithheldCharge: false,
  });
  assert.deepEqual(foldChargeRows([{}, { status: "failed" }] as any), {
    hasCompletedCharge: false,
    hasPendingCharge: false,
    hasRefundedCharge: false,
    hasWithheldCharge: false,
  });
});

test("only unpaid and refunded are actionable", () => {
  assert.equal(isActionable("unpaid"), true);
  assert.equal(isActionable("refunded"), true);
  assert.equal(isActionable("paid"), false);
  assert.equal(isActionable("free"), false);
  assert.equal(isActionable("in_flight"), false);
});

test("summarizeVerdicts counts every bucket", () => {
  assert.deepEqual(summarizeVerdicts(["paid", "paid", "unpaid", "free", "withheld"]), {
    free: 1,
    paid: 2,
    withheld: 1,
    in_flight: 0,
    refunded: 0,
    unpaid: 1,
  });
});

test("recordCountsByStatus maps each grouped status to its total", () => {
  assert.deepEqual(
    recordCountsByStatus([
      { _id: "completed", count: 44 },
      { _id: "refunded", count: 3 },
      { _id: "pending", count: 2 },
      { _id: "withheld", count: 1 },
    ]),
    { completed: 44, refunded: 3, pending: 2, withheld: 1 },
  );
});

test("recordCountsByStatus reports zero for a status with no rows", () => {
  assert.deepEqual(recordCountsByStatus([{ _id: "completed", count: 5 }]), {
    completed: 5,
    refunded: 0,
    pending: 0,
    withheld: 0,
  });
  assert.deepEqual(recordCountsByStatus([]), { completed: 0, refunded: 0, pending: 0, withheld: 0 });
});

test("a proposed 1:1 waiting for payment is not a problem", () => {
  const check = checkSeat({
    type: "individual",
    status: "pending",
    paymentDeadline: "2026-10-20T00:00:00.000Z",
    priceCents: 5000,
    ownCharges: [],
  });
  assert.equal(check.verdict, "waiting");
  assert.equal(check.list, false);
});

test("a later series date is paid when the charge is on another date", () => {
  const check = checkSeat({
    type: "seminar",
    status: "active",
    priceCents: 2500,
    ownCharges: [],
    seriesHasCompletedCharge: true,
  });
  assert.equal(check.verdict, "paid");
  assert.equal(check.list, false);
});

test("a refunded charge with the person still enrolled stays on the list", () => {
  const check = checkSeat({
    type: "individual",
    status: "active",
    priceCents: 8000,
    ownCharges: [{ status: "refunded" }],
  });
  assert.equal(check.verdict, "refunded");
  assert.equal(check.list, true);
});

test("an enrolled paid seat with no charge and no payment window stays on the list", () => {
  const check = checkSeat({
    type: "seminar",
    status: "active",
    priceCents: 4000,
    ownCharges: [],
  });
  assert.equal(check.verdict, "unpaid");
  assert.equal(check.list, true);
});

test("recordCountsByStatus ignores statuses without a tile and junk groups", () => {
  assert.deepEqual(
    recordCountsByStatus([
      { _id: "failed", count: 9 },
      { _id: "released", count: 7 },
      { _id: null, count: 4 },
      { _id: "completed", count: "x" },
      {},
    ] as any),
    { completed: 0, refunded: 0, pending: 0, withheld: 0 },
  );
});

test("an admin refund row marks its completed charge as refunded, partial or full", () => {
  const rows = markRefundedCharges(
    [
      { status: "completed", paymentIntent: "pi_refunded" },
      { status: "completed", paymentIntent: "pi_kept" },
      { status: "withheld", paymentIntent: "pi_refunded" },
      { status: "completed" },
    ],
    new Set(["pi_refunded"]),
  );
  assert.deepEqual(rows.map((r) => r.status), ["refunded", "completed", "withheld", "completed"]);
});

test("a seat whose only charge an admin refunded is flagged", () => {
  const ownCharges = markRefundedCharges([{ status: "completed", paymentIntent: "pi_1" }], new Set(["pi_1"]));
  const check = checkSeat({ type: "seminar", status: "active", priceCents: 2000, ownCharges });
  assert.deepEqual(check, { verdict: "refunded", list: true });
});

test("a refund on a finished session is history, not a seat to take back", () => {
  const check = checkSeat({
    type: "individual",
    status: "active",
    priceCents: 2000,
    ownCharges: [{ status: "refunded" }],
    sessionEnded: true,
  });
  assert.deepEqual(check, { verdict: "refunded", list: false });
});

test("an unpaid seat is still flagged after the session ends", () => {
  const check = checkSeat({ type: "seminar", status: "active", priceCents: 2000, ownCharges: [], sessionEnded: true });
  assert.deepEqual(check, { verdict: "unpaid", list: true });
});

test("sessionHasEnded uses the end, else start plus duration, and never ends an undated session", () => {
  const now = Date.parse("2026-10-23T12:00:00.000Z");
  assert.equal(sessionHasEnded({ end: "2026-10-23T11:59:00.000Z" }, now), true);
  assert.equal(sessionHasEnded({ start: "2026-10-23T11:00:00.000Z", end: "2026-10-23T12:30:00.000Z" }, now), false);
  assert.equal(sessionHasEnded({ end: "2026-10-23T12:00:00.000Z" }, now), true);
  assert.equal(sessionHasEnded({ start: "2026-10-23T11:30:00.000Z", duration: 60 }, now), false);
  assert.equal(sessionHasEnded({ start: "2026-10-23T10:30:00.000Z", duration: 60 }, now), true);
  assert.equal(sessionHasEnded({ start: "2026-10-23T11:30:00.000Z" }, now), true);
  assert.equal(sessionHasEnded({}, now), false);
  assert.equal(sessionHasEnded(null, now), false);
  assert.equal(sessionHasEnded({ end: "not a date", start: "also not" }, now), false);
});

test("a series date whose payment on another date was refunded reads as refunded, not unpaid", () => {
  const check = checkSeat({
    type: "seminar",
    status: "active",
    priceCents: 1000,
    ownCharges: [],
    seriesHasRefundedCharge: true,
  });
  assert.deepEqual(check, { verdict: "refunded", list: true });
  assert.deepEqual(
    checkSeat({ type: "seminar", status: "active", priceCents: 1000, ownCharges: [], seriesHasRefundedCharge: true, sessionEnded: true }),
    { verdict: "refunded", list: false },
  );
  assert.equal(
    checkSeat({ type: "seminar", status: "active", priceCents: 1000, ownCharges: [], seriesHasRefundedCharge: true, seriesHasCompletedCharge: true }).verdict,
    "paid",
  );
});
