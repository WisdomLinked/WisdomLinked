import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyBookingPayment,
  foldChargeRows,
  isActionable,
  summarizeVerdicts,
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
