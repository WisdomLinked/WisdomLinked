import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeBookingPriceCents,
  dollarsToCents,
  extractHourlyRate,
  assertPaymentMatchesExpected,
  balanceTransactionId,
  expectedBookingIntentCents,
  assertIntentMatchesBooking,
  voluntaryCancellationRefundCents,
  capturedAmountCents,
  settlementMatchCents,
  computeSessionCharge,
  validatePricingRates,
  validatePricingSettings,
  cancellationRefundCents,
  defaultCancellationRefund,
  normalizePricingRates,
  DEFAULT_PRICING_RATES,
} from "../utils/bookingPrice";

describe("computeBookingPriceCents", () => {
  // Regression: with a single $75/hr rate, every allowed duration must be > 0.
  // The old code indexed price[durationIdx], so 60-min bookings got 0 and skipped payment.
  it("scales the hourly rate by duration for all allowed durations", () => {
    assert.equal(computeBookingPriceCents(30, 75), 3750);
    assert.equal(computeBookingPriceCents(60, 75), 7500);
    assert.equal(computeBookingPriceCents(90, 75), 11250);
  });

  it("returns 0 only when the rate is 0 (the free path)", () => {
    assert.equal(computeBookingPriceCents(60, 0), 0);
    assert.equal(computeBookingPriceCents(0, 75), 0);
  });

  it("always returns whole cents and round-trips through the Stripe amount", () => {
    // The expected amount must be an integer (Stripe rejects fractional cents)...
    const cents = computeBookingPriceCents(30, 19.99);
    assert.ok(Number.isInteger(cents));
    // ...and survive the dollars round-trip the client/server use when charging:
    // FE sends dollars = cents/100, BE charges Math.round(dollars * 100). It must
    // come back to the same cents, or the amount-match check would falsely reject.
    const dollarsSentToStripe = cents / 100;
    assert.equal(Math.round(dollarsSentToStripe * 100), cents);
  });
});

describe("voluntaryCancellationRefundCents", () => {
  it("refunds the charge minus the 2.9% + 30c processing fee", () => {
    // $200.00 charge: fee = round(20000 * 0.029) + 30 = 580 + 30 = 610 -> refund 19390.
    assert.equal(voluntaryCancellationRefundCents(20000), 19390);
    // $50.00: fee = round(5000 * 0.029) + 30 = 145 + 30 = 175 -> refund 4825.
    assert.equal(voluntaryCancellationRefundCents(5000), 4825);
  });

  it("never returns a negative refund for tiny charges", () => {
    assert.equal(voluntaryCancellationRefundCents(20), 0);
    assert.equal(voluntaryCancellationRefundCents(0), 0);
    assert.equal(voluntaryCancellationRefundCents(-100), 0);
    assert.equal(voluntaryCancellationRefundCents(null), 0);
  });

  it("retains a fee on every cycle, so refund is always strictly less than the charge", () => {
    assert.ok(voluntaryCancellationRefundCents(10000) < 10000);
  });
});

describe("capturedAmountCents", () => {
  it("uses amount_received after a partial capture, not the original authorization", () => {
    // Authorized $100, host captured $80 after a price drop: record $80, not $100.
    assert.equal(capturedAmountCents({ amount: 10000, amount_received: 8000 }), 8000);
  });

  it("equals amount on a full capture", () => {
    assert.equal(capturedAmountCents({ amount: 5000, amount_received: 5000 }), 5000);
  });

  it("falls back to amount when amount_received is missing or zero", () => {
    assert.equal(capturedAmountCents({ amount: 5000 }), 5000);
    assert.equal(capturedAmountCents({ amount: 5000, amount_received: 0 }), 5000);
  });
});

describe("extractHourlyRate", () => {
  it("reads a plain number rate", () => {
    assert.equal(extractHourlyRate(75), 75);
  });

  it("reads the first element when stored as an array", () => {
    assert.equal(extractHourlyRate([75]), 75);
  });

  it("treats missing or empty values as 0 (free)", () => {
    assert.equal(extractHourlyRate([]), 0);
    assert.equal(extractHourlyRate(undefined), 0);
    assert.equal(extractHourlyRate(null), 0);
    assert.equal(extractHourlyRate("not-a-number"), 0);
  });
});

describe("dollarsToCents", () => {
  it("converts a stored dollar price to integer cents", () => {
    assert.equal(dollarsToCents(75), 7500);
    assert.equal(dollarsToCents(9.99), 999);
    assert.equal(dollarsToCents(0), 0);
    assert.equal(dollarsToCents(undefined), 0);
  });
});

describe("expectedBookingIntentCents", () => {
  // The PaymentIntent amount is derived server-side from booking identity, never
  // from a client-supplied dollar figure. These two branches must match the price
  // math run at booking completion so the intent and the final check always agree.
  it("1:1 path: computes rate x duration from the expert's hourly rate", () => {
    assert.equal(
      expectedBookingIntentCents({ kind: "oneToOne", durationMinutes: 60, hourlyRateDollars: 75 }),
      computeBookingPriceCents(60, 75),
    );
    assert.equal(
      expectedBookingIntentCents({ kind: "oneToOne", durationMinutes: 30, hourlyRateDollars: 75 }),
      3750,
    );
  });

  it("groupChat path: uses the stored price and does NOT recompute from an hourly rate", () => {
    // Seminars and expert propose-and-pay both carry an approved custom price on
    // the GroupChat; recomputing from a rate would reject the expert's own price.
    assert.equal(
      expectedBookingIntentCents({ kind: "groupChat", priceDollars: 40 }),
      dollarsToCents(40),
    );
    assert.equal(expectedBookingIntentCents({ kind: "groupChat", priceDollars: 9.99 }), 999);
  });

  it("treats missing/zero prices as the free path (0 cents)", () => {
    assert.equal(expectedBookingIntentCents({ kind: "groupChat", priceDollars: undefined }), 0);
    assert.equal(
      expectedBookingIntentCents({ kind: "oneToOne", durationMinutes: 60, hourlyRateDollars: 0 }),
      0,
    );
  });
});

describe("assertPaymentMatchesExpected", () => {
  const okIntent = { amount: 7500, currency: "usd" };

  it("free path: returns null and requires no payment", () => {
    assert.equal(assertPaymentMatchesExpected(0, undefined, false, false), null);
    // A free booking is fine even if no payment_intent was ever created.
    assert.equal(assertPaymentMatchesExpected(0, undefined, false, false), null);
  });

  it("paid path: throws when no payment_intent was provided", () => {
    assert.throws(
      () => assertPaymentMatchesExpected(7500, undefined, false, false),
      /Payment intent is required/,
    );
  });

  it("paid path: throws when the intent did not succeed in either mode", () => {
    assert.throws(
      () => assertPaymentMatchesExpected(7500, "pi_123", false, false),
      /Payment intent not succeeded/,
    );
  });

  it("paid path: throws when the paid amount does not match the expected price", () => {
    // The underpayment attack: a succeeded $1 intent for a $75 booking.
    assert.throws(
      () => assertPaymentMatchesExpected(7500, "pi_123", { amount: 100, currency: "usd" }, false),
      /Payment amount does not match expected price/,
    );
  });

  it("paid path: returns verified test-mode charge details on a correct payment", () => {
    // No expanded latest_charge on okIntent, so receipt fields default to null.
    assert.deepEqual(
      assertPaymentMatchesExpected(7500, "pi_123", okIntent, false),
      { paidBy: "test", amount: 7500, currency: "usd", receiptUrl: null, receiptNumber: null, balanceTransaction: null },
    );
  });

  it("paid path: returns verified live-mode charge details on a correct payment", () => {
    assert.deepEqual(
      assertPaymentMatchesExpected(7500, "pi_123", false, okIntent),
      { paidBy: "live", amount: 7500, currency: "usd", receiptUrl: null, receiptNumber: null, balanceTransaction: null },
    );
  });

  it("paid path: extracts receipt url/number from an expanded latest_charge", () => {
    // When the BE retrieves the intent with { expand: ['latest_charge'] }, the
    // charge is a full object carrying Stripe's receipt fields — persist them.
    const intentWithReceipt = {
      amount: 7500,
      currency: "usd",
      latest_charge: {
        receipt_url: "https://pay.stripe.com/receipts/abc123",
        receipt_number: "2net-1234",
      },
    };
    assert.deepEqual(
      assertPaymentMatchesExpected(7500, "pi_123", intentWithReceipt, false),
      {
        paidBy: "test",
        amount: 7500,
        currency: "usd",
        receiptUrl: "https://pay.stripe.com/receipts/abc123",
        receiptNumber: "2net-1234",
        balanceTransaction: null,
      },
    );
  });

  it("paid path: receipt fields are null when latest_charge is an unexpanded id string", () => {
    // If the intent was not retrieved with expand, latest_charge is just an id.
    const intentUnexpanded = { amount: 7500, currency: "usd", latest_charge: "ch_123" };
    assert.deepEqual(
      assertPaymentMatchesExpected(7500, "pi_123", intentUnexpanded, false),
      { paidBy: "test", amount: 7500, currency: "usd", receiptUrl: null, receiptNumber: null, balanceTransaction: null },
    );
  });

  it("paid path: a partial latest_charge fills only the fields Stripe provided", () => {
    // receipt_number can be absent (e.g. test mode) while receipt_url exists.
    const intentPartial = {
      amount: 7500,
      currency: "usd",
      latest_charge: { receipt_url: "https://pay.stripe.com/receipts/only-url" },
    };
    assert.deepEqual(
      assertPaymentMatchesExpected(7500, "pi_123", intentPartial, false),
      {
        paidBy: "test",
        amount: 7500,
        currency: "usd",
        receiptUrl: "https://pay.stripe.com/receipts/only-url",
        receiptNumber: null,
        balanceTransaction: null,
      },
    );
  });
});

describe("assertIntentMatchesBooking", () => {
  const seminarIntent = {
    amount: 5000,
    currency: "usd",
    metadata: { bookingType: "groupChat", groupChatId: "sem_A", userId: "stu_1" },
  };

  it("accepts an intent raised for this seminar by this student", () => {
    assert.doesNotThrow(() =>
      assertIntentMatchesBooking(seminarIntent, { userId: "stu_1", groupChatId: "sem_A" }),
    );
  });

  it("rejects an intent paid for a different seminar of the same price", () => {
    assert.throws(
      () => assertIntentMatchesBooking(seminarIntent, { userId: "stu_1", groupChatId: "sem_B" }),
      /not created for this booking/,
    );
  });

  it("rejects an intent paid by a different account", () => {
    assert.throws(
      () => assertIntentMatchesBooking(seminarIntent, { userId: "stu_2", groupChatId: "sem_A" }),
      /different account/,
    );
  });

  it("rejects a 1:1 intent reused for a seminar booking", () => {
    const oneToOne = {
      amount: 5000,
      currency: "usd",
      metadata: { bookingType: "oneToOne", expertId: "exp_1", userId: "stu_1" },
    };
    assert.throws(
      () => assertIntentMatchesBooking(oneToOne, { userId: "stu_1", groupChatId: "sem_A" }),
      /not created for this booking/,
    );
  });

  it("rejects an intent with no payer identity, so it can't be redeemed by anyone", () => {
    // An intent lacking userId metadata must not be usable by an arbitrary account for
    // the same booking — the payer binding has to be present and match.
    const noPayer = {
      amount: 5000,
      currency: "usd",
      metadata: { bookingType: "groupChat", groupChatId: "sem_A" },
    };
    assert.throws(
      () => assertIntentMatchesBooking(noPayer, { userId: "stu_9", groupChatId: "sem_A" }),
      /different account/,
    );
    // The booking binding is still checked first for a genuinely wrong booking.
    assert.throws(
      () => assertIntentMatchesBooking(noPayer, { userId: "stu_9", groupChatId: "sem_B" }),
      /not created for this booking/,
    );
  });

  it("rejects an intent carrying no metadata at all", () => {
    assert.throws(
      () => assertIntentMatchesBooking({ amount: 5000, currency: "usd" }, { userId: "stu_1", groupChatId: "sem_A" }),
      /not created for this booking/,
    );
  });
});

describe("balanceTransactionId", () => {
  it("reads the ledger reference whether Stripe expanded it or not", () => {
    // A payout is made of balance transactions, so this is what finance reconciles
    // against — and it is a different id from the payment intent.
    assert.equal(balanceTransactionId({ balance_transaction: "txn_1ABC" }), "txn_1ABC");
    assert.equal(balanceTransactionId({ balance_transaction: { id: "txn_1ABC" } }), "txn_1ABC");
  });

  it("is null while the money has not settled, rather than guessing", () => {
    assert.equal(balanceTransactionId({ balance_transaction: null }), null);
    assert.equal(balanceTransactionId({}), null);
    assert.equal(balanceTransactionId(null), null);
  });
});

const defaults = DEFAULT_PRICING_RATES;

describe("computeSessionCharge", () => {
  // Math.round, half up. These cases are the contract for Stripe and wallet.
  it("charges 3% on $100, capped later, with a 20% expert commission", () => {
    const quote = computeSessionCharge(10000, defaults, "oneToOne");
    assert.equal(quote.platformFeeCents, 300);
    assert.equal(quote.taxCents, 0);
    assert.equal(quote.chargeCents, 10300);
    assert.equal(quote.commissionCents, 2000);
    assert.equal(quote.expertNetCents, 8000);
  });

  it("caps the student fee at $5 on a $200 session", () => {
    const quote = computeSessionCharge(20000, defaults, "seminar");
    assert.equal(quote.platformFeeCents, 500);
    assert.equal(quote.chargeCents, 20500);
    assert.equal(quote.expertNetCents, 16000);
  });

  it("taxes the advertised price and the platform fee", () => {
    const quote = computeSessionCharge(10000, { ...defaults, taxPercent: 8 }, "oneToOne");
    assert.equal(quote.taxCents, 824);
    assert.equal(quote.chargeCents, 11124);
    assert.equal(quote.expertNetCents, 8000);
  });

  it("charges the flat free-session fee and no commission", () => {
    const quote = computeSessionCharge(0, defaults, "seminar");
    assert.equal(quote.platformFeeCents, 100);
    assert.equal(quote.taxCents, 0);
    assert.equal(quote.chargeCents, 100);
    assert.equal(quote.expertNetCents, 0);
    assert.equal(quote.commissionCents, 0);
  });

  it("taxes the free-session fee", () => {
    const quote = computeSessionCharge(0, { ...defaults, taxPercent: 8 }, "seminar");
    assert.equal(quote.taxCents, 8);
    assert.equal(quote.chargeCents, 108);
    assert.equal(quote.expertNetCents, 0);
  });

  it("is truly free when the free-session fee is 0", () => {
    const quote = computeSessionCharge(0, { ...defaults, freeSessionPlatformFeeDollars: 0, taxPercent: 8 }, "oneToOne");
    assert.equal(quote.chargeCents, 0);
    assert.equal(quote.taxCents, 0);
    assert.equal(quote.platformFeeCents, 0);
  });

  it("does not let seminar rates change a 1:1 charge", () => {
    const seminarRates = { ...defaults, studentFeePercent: 10, studentFeeCapDollars: 20, expertCommissionPercent: 40 };
    const seminar = computeSessionCharge(10000, seminarRates, "seminar");
    const oneToOne = computeSessionCharge(10000, defaults, "oneToOne");
    assert.equal(seminar.chargeCents, 11000);
    assert.equal(seminar.expertNetCents, 6000);
    assert.equal(oneToOne.chargeCents, 10300);
    assert.equal(oneToOne.expertNetCents, 8000);
  });
});

describe("settlementMatchCents", () => {
  it("captures an authorization from a previous fee-inclusive total", () => {
    // Advertised $100. Yesterday's rates charged $111.24. Today's total is $103.00.
    assert.equal(settlementMatchCents(11124, 10300, 10000, 11124), 11124);
  });

  it("still accepts today's total and a legacy hold at the advertised price", () => {
    assert.equal(settlementMatchCents(10300, 10300, 10000, 10300), 10300);
    assert.equal(settlementMatchCents(10000, 10300, 10000), 10000);
  });

  it("rejects an amount that is not the authorization on the intent", () => {
    // $1 is neither today's total, the advertised price, nor the stored authorization.
    assert.equal(settlementMatchCents(100, 10300, 10000, 11124), 10300);
    assert.equal(settlementMatchCents(100, 10300, 10000), 10300);
  });
});

describe("pricing settings validation", () => {
  it("rejects negatives and percents outside 0 to 100", () => {
    assert.equal(validatePricingRates({ ...defaults, studentFeePercent: -1 }).ok, false);
    assert.equal(validatePricingRates({ ...defaults, taxPercent: 101 }).ok, false);
    assert.equal(validatePricingRates({ ...defaults, freeSessionPlatformFeeDollars: -0.01 }).ok, false);
    assert.equal(validatePricingRates({ ...defaults, expertCommissionPercent: 0 }).ok, true);
    assert.equal(validatePricingRates({ ...defaults, taxPercent: 100 }).ok, true);
  });

  it("requires both groups and reports which one failed", () => {
    const bad = validatePricingSettings({ seminar: defaults, oneToOne: { ...defaults, studentFeeCapDollars: -1 } });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.error, /1:1/);
    const good = validatePricingSettings({ seminar: defaults, oneToOne: defaults });
    assert.equal(good.ok, true);
    if (good.ok) {
      assert.equal(good.seminar.cancellationRefund, "processing_fee");
      assert.equal(good.oneToOne.cancellationRefund, "full");
    }
    assert.equal(validatePricingRates({ ...defaults, cancellationRefund: "nope" }).ok, false);
  });
});

describe("cancellation refund rules", () => {
  const paid = { amount: 10300, advertisedCents: 10000, platformFeeCents: 300, taxCents: 0 };

  it("refunds a $103 charge by the selected rule", () => {
    assert.equal(cancellationRefundCents("full", paid), 10300);
    assert.equal(cancellationRefundCents("keep_platform_fee", paid), 10000);
    assert.equal(cancellationRefundCents("processing_fee", paid), voluntaryCancellationRefundCents(10300));
  });

  it("keeps the platform fee on a free-session charge and refunds it in full otherwise", () => {
    const free = { amount: 100, advertisedCents: 0, platformFeeCents: 100, taxCents: 0 };
    assert.equal(cancellationRefundCents("keep_platform_fee", free), 0);
    assert.equal(cancellationRefundCents("full", free), 100);
  });

  it("treats an old row with only an amount as fee 0 and tax 0", () => {
    assert.equal(cancellationRefundCents("keep_platform_fee", { amount: 10000 }), 10000);
  });

  it("defaults seminars to the card fee and 1:1 sessions to a full refund", () => {
    assert.equal(defaultCancellationRefund("seminar"), "processing_fee");
    assert.equal(defaultCancellationRefund("oneToOne"), "full");
    assert.equal(normalizePricingRates({}, "seminar").cancellationRefund, "processing_fee");
    assert.equal(normalizePricingRates({}, "oneToOne").cancellationRefund, "full");
  });
});
