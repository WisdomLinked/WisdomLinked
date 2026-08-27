import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePaymentMode,
  isWallet,
  paymentWindowHours,
  paymentWindowDeadline,
  paymentWindowLapsed,
  walletChargeAllowed,
  pinnedSettlementMode,
  DEFAULT_PAYMENT_WINDOW_HOURS,
  WALLET_PAYMENT_METHOD_TYPES,
} from "../utils/walletPayment";

const NOW = Date.UTC(2026, 7, 14, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

test("payment mode defaults to card for anything that is not the wallet literal", () => {
  assert.equal(normalizePaymentMode("wallet"), "wallet");
  assert.equal(normalizePaymentMode("card"), "card");
  assert.equal(normalizePaymentMode(undefined), "card");
  assert.equal(normalizePaymentMode(null), "card");
  assert.equal(normalizePaymentMode("WALLET"), "card");
  assert.equal(normalizePaymentMode({ mode: "wallet" }), "card");
  assert.equal(isWallet("wallet"), true);
  assert.equal(isWallet("card"), false);
});

test("wechat pay and alipay are the wallet methods offered", () => {
  assert.deepEqual(WALLET_PAYMENT_METHOD_TYPES, ["alipay", "wechat_pay"]);
});

test("the payment window falls back to 48h and is clamped to a week", () => {
  assert.equal(paymentWindowHours(null), DEFAULT_PAYMENT_WINDOW_HOURS);
  assert.equal(paymentWindowHours({}), 48);
  assert.equal(paymentWindowHours({ paymentWindowHours: 24 }), 24);
  assert.equal(paymentWindowHours({ paymentWindowHours: 0 }), 48);
  assert.equal(paymentWindowHours({ paymentWindowHours: -3 }), 48);
  assert.equal(paymentWindowHours({ paymentWindowHours: "12" }), 48);
  assert.equal(paymentWindowHours({ paymentWindowHours: 5000 }), 168);
  // The retired per-rail settings must not steer the one window that replaced them.
  assert.equal(paymentWindowHours({ walletPaymentWindowHours: 72 }), 48);
  assert.equal(paymentWindowHours({ proposalPaymentWindowHours: 72 }), 48);
});

test("a student gets the full window when the session is far enough out", () => {
  const deadline = paymentWindowDeadline({
    sessionStartMs: NOW + 30 * DAY,
    windowHours: 24,
    now: NOW,
  });
  assert.equal(deadline.getTime(), NOW + 24 * HOUR);
});

test("the window never runs past the session it is paying for", () => {
  const start = NOW + 6 * HOUR;
  const deadline = paymentWindowDeadline({ sessionStartMs: start, windowHours: 24, now: NOW });
  assert.equal(deadline.getTime(), start);
});

test("a session that already started still yields a deadline no earlier than now", () => {
  const deadline = paymentWindowDeadline({
    sessionStartMs: NOW - 2 * HOUR,
    windowHours: 24,
    now: NOW,
  });
  // The past start is ignored rather than producing an already-expired window.
  assert.equal(deadline.getTime(), NOW + 24 * HOUR);
});

test("an undated session just gets the plain window", () => {
  const deadline = paymentWindowDeadline({ windowHours: 24, now: NOW });
  assert.equal(deadline.getTime(), NOW + 24 * HOUR);
});

test("a lapsed window is detected from a Date, a string, or not at all", () => {
  assert.equal(paymentWindowLapsed(new Date(NOW - 1), NOW), true);
  assert.equal(paymentWindowLapsed(new Date(NOW + 1), NOW), false);
  assert.equal(paymentWindowLapsed(new Date(NOW).toISOString(), NOW), true);
  // No deadline means nothing to lapse — an unaccepted request is not expired.
  assert.equal(paymentWindowLapsed(null, NOW), false);
  assert.equal(paymentWindowLapsed(undefined, NOW), false);
  assert.equal(paymentWindowLapsed("not a date", NOW), false);
});

test("a wallet may charge for a seminar seat that is free to take", () => {
  assert.equal(walletChargeAllowed({ flow: "seminarOpenSeat" }), true);
});

test("a wallet may not charge for anything still awaiting a decision", () => {
  assert.equal(walletChargeAllowed({ flow: "oneToOne", approved: false }), false);
  assert.equal(walletChargeAllowed({ flow: "seminarSeatRequest", approved: false }), false);
});

test("a wallet may charge once the expert or host has committed", () => {
  assert.equal(walletChargeAllowed({ flow: "oneToOne", approved: true }), true);
  assert.equal(walletChargeAllowed({ flow: "seminarSeatRequest", approved: true }), true);
});

test("an unknown flow is refused rather than defaulting to chargeable", () => {
  assert.equal(walletChargeAllowed({ flow: "somethingElse" } as any), false);
});

test("a wallet booking must be settled by wallet, closing the card opt-out", () => {
  // Requesting by wallet skips the card authorization that commits a student before an
  // expert decides. If it could then be paid by card, every student would route through
  // the wallet tab to avoid the hold, and the deposit would mean nothing.
  assert.equal(pinnedSettlementMode("wallet"), "wallet");
});

test("a card booking stays on the card path", () => {
  assert.equal(pinnedSettlementMode("card"), "card");
});

test("a booking with no recorded mode settles as card, never as wallet", () => {
  // Failing open to 'wallet' would let an unknown mode dodge the hold.
  assert.equal(pinnedSettlementMode(undefined), "card");
  assert.equal(pinnedSettlementMode(null), "card");
  assert.equal(pinnedSettlementMode("WALLET"), "card");
  assert.equal(pinnedSettlementMode({}), "card");
});
