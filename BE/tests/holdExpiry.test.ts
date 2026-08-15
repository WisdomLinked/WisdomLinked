import test from "node:test";
import assert from "node:assert/strict";

import {
  captureBeforeMs,
  decisionDeadlineFrom,
  holdHasLapsed,
  HOLD_SAFETY_MARGIN_MS,
  HOLD_FALLBACK_WINDOW_MS,
} from "../utils/holdExpiry";

const NOW = Date.UTC(2026, 7, 12, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const intentWith = (captureBeforeSec: any) => ({
  latest_charge: { payment_method_details: { card: { capture_before: captureBeforeSec } } },
});

test("capture_before is read from the expanded charge", () => {
  const seconds = Math.floor((NOW + 7 * DAY) / 1000);
  assert.equal(captureBeforeMs(intentWith(seconds)), seconds * 1000);
});

test("a missing or nonsense capture_before reads as absent", () => {
  assert.equal(captureBeforeMs(null), 0);
  assert.equal(captureBeforeMs({}), 0);
  assert.equal(captureBeforeMs({ latest_charge: "ch_123" }), 0);
  assert.equal(captureBeforeMs(intentWith(undefined)), 0);
  assert.equal(captureBeforeMs(intentWith(0)), 0);
  assert.equal(captureBeforeMs(intentWith(-5)), 0);
  assert.equal(captureBeforeMs(intentWith("soon")), 0);
});

test("the expert gets the whole window Stripe allows, less the safety margin", () => {
  const captureBefore = NOW + 7 * DAY;
  const deadline = decisionDeadlineFrom({
    captureBefore,
    sessionStartMs: NOW + 30 * DAY,
    now: NOW,
  });
  assert.equal(deadline.getTime(), captureBefore - HOLD_SAFETY_MARGIN_MS);
});

test("a short Visa merchant-initiated window shortens the deadline with it", () => {
  const captureBefore = NOW + 4 * DAY + 18 * 60 * 60 * 1000;
  const deadline = decisionDeadlineFrom({
    captureBefore,
    sessionStartMs: NOW + 30 * DAY,
    now: NOW,
  });
  assert.equal(deadline.getTime(), captureBefore - HOLD_SAFETY_MARGIN_MS);
  assert.ok(deadline.getTime() < NOW + 5 * DAY, "well inside the 7-day assumption");
});

test("a session starting before the hold lapses caps the decision", () => {
  const deadline = decisionDeadlineFrom({
    captureBefore: NOW + 7 * DAY,
    sessionStartMs: NOW + 2 * DAY,
    now: NOW,
  });
  assert.equal(deadline.getTime(), NOW + 2 * DAY);
});

test("no capture_before falls back to a conservative window", () => {
  const deadline = decisionDeadlineFrom({ captureBefore: 0, now: NOW });
  assert.equal(deadline.getTime(), NOW + HOLD_FALLBACK_WINDOW_MS - HOLD_SAFETY_MARGIN_MS);
});

test("a very short-notice booking never yields a deadline in the past", () => {
  const deadline = decisionDeadlineFrom({
    captureBefore: NOW + 7 * DAY,
    sessionStartMs: NOW - DAY,
    now: NOW,
  });
  assert.equal(deadline.getTime(), NOW);
});

test("a hold whose margin already elapsed still floors at now", () => {
  const deadline = decisionDeadlineFrom({
    captureBefore: NOW + 60 * 1000,
    now: NOW,
  });
  assert.equal(deadline.getTime(), NOW);
});

test("lapsed holds are recognised from a Date or a string, and absent ones are not", () => {
  assert.equal(holdHasLapsed(new Date(NOW - 1), NOW), true);
  assert.equal(holdHasLapsed(new Date(NOW + 1), NOW), false);
  assert.equal(holdHasLapsed(new Date(NOW).toISOString(), NOW), true);
  assert.equal(holdHasLapsed(null, NOW), false);
  assert.equal(holdHasLapsed(undefined, NOW), false);
  assert.equal(holdHasLapsed("not a date", NOW), false);
});
