import test from "node:test";
import assert from "node:assert/strict";
import { paymentIntentStillSettling } from "../utils/bookingPaymentSettle";

test("a WeChat intent waiting on the provider is still settling", () => {
  assert.equal(paymentIntentStillSettling({ status: "requires_action" }), true);
  assert.equal(paymentIntentStillSettling({ status: "requires_confirmation" }), true);
  assert.equal(paymentIntentStillSettling({ status: "requires_payment_method" }), true);
});

test("a provider decline is not still settling", () => {
  assert.equal(paymentIntentStillSettling({
    status: "requires_payment_method",
    last_payment_error: { decline_code: "partner_generic_decline" },
  }), false);
  assert.equal(paymentIntentStillSettling({ status: "canceled" }), false);
  assert.equal(paymentIntentStillSettling({ status: "succeeded" }), false);
  assert.equal(paymentIntentStillSettling(null), false);
});
