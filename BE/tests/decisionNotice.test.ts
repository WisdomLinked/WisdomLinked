import test from "node:test";
import assert from "node:assert/strict";

import {
  DECISION_NOTICE_TTL_MS,
  decisionNoticeCutoff,
  decisionNoticeExpiresAt,
  decisionNoticeIsVisible,
  resolveSessionDecisionOutcome,
  resolveSeatDecisionOutcome,
} from "../utils/decisionNotice";

const NOW = Date.parse("2026-08-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60 * 1000).toISOString();

test("a fresh unread note is shown", () => {
  assert.equal(
    decisionNoticeIsVisible({ note: "Try a week later", decidedAt: hoursAgo(2) }, NOW),
    true,
  );
});

test("a note the student dismissed is gone even inside the window", () => {
  assert.equal(
    decisionNoticeIsVisible(
      { note: "Try a week later", decidedAt: hoursAgo(2), readAt: hoursAgo(1) },
      NOW,
    ),
    false,
  );
});

test("a note older than 48 hours expires on its own", () => {
  assert.equal(
    decisionNoticeIsVisible({ note: "Try a week later", decidedAt: hoursAgo(49) }, NOW),
    false,
  );
});

test("the boundary is exclusive — exactly 48 hours old is already expired", () => {
  assert.equal(
    decisionNoticeIsVisible(
      { note: "n", decidedAt: new Date(NOW - DECISION_NOTICE_TTL_MS).toISOString() },
      NOW,
    ),
    false,
  );
  assert.equal(
    decisionNoticeIsVisible(
      { note: "n", decidedAt: new Date(NOW - DECISION_NOTICE_TTL_MS + 1000).toISOString() },
      NOW,
    ),
    true,
  );
});

test("a decision with no note is not a notice", () => {
  assert.equal(decisionNoticeIsVisible({ note: "", decidedAt: hoursAgo(1) }, NOW), false);
  assert.equal(decisionNoticeIsVisible({ note: "   ", decidedAt: hoursAgo(1) }, NOW), false);
  assert.equal(decisionNoticeIsVisible({ decidedAt: hoursAgo(1) }, NOW), false);
});

test("an undateable decision expires rather than sticking around forever", () => {
  assert.equal(decisionNoticeIsVisible({ note: "n" }, NOW), false);
  assert.equal(decisionNoticeIsVisible({ note: "n", decidedAt: "not a date" }, NOW), false);
});

test("the expiry instant is 48 hours after the decision", () => {
  assert.equal(
    decisionNoticeExpiresAt({ note: "n", decidedAt: hoursAgo(1) }),
    NOW - 60 * 60 * 1000 + DECISION_NOTICE_TTL_MS,
  );
  assert.equal(decisionNoticeExpiresAt({ note: "n" }), null);
});

test("the query cutoff matches the window, so expired rows are never fetched", () => {
  assert.equal(decisionNoticeCutoff(NOW).getTime(), NOW - DECISION_NOTICE_TTL_MS);
});

test("an active session reads as accepted", () => {
  assert.equal(
    resolveSessionDecisionOutcome({ status: "active", expertCreated: false }),
    "accepted",
  );
});

test("a cancelled student request reads as declined", () => {
  assert.equal(
    resolveSessionDecisionOutcome({ status: "cancelled", expertCreated: false }),
    "declined",
  );
});

test("a cancelled expert proposal reads as withdrawn, not declined", () => {
  assert.equal(
    resolveSessionDecisionOutcome({ status: "cancelled", expertCreated: true }),
    "withdrawn",
  );
});

test("an accepted wallet session awaiting payment is not a decline", () => {
  // The expert said yes; the booking is simply not paid for yet. Calling this
  // 'declined' told the student the opposite of what happened.
  assert.equal(
    resolveSessionDecisionOutcome({
      status: "pending",
      expertCreated: false,
      awaitingPayment: true,
    }),
    "accepted_awaiting_payment",
  );
});

test("cancellation still wins over an unpaid window", () => {
  assert.equal(
    resolveSessionDecisionOutcome({
      status: "cancelled",
      expertCreated: false,
      awaitingPayment: true,
    }),
    "declined",
  );
});

test("a pending session with no payment window keeps the old reading", () => {
  assert.equal(
    resolveSessionDecisionOutcome({ status: "pending", expertCreated: false }),
    "declined",
  );
});

test("seat outcomes distinguish approved, awaiting payment, and rejected", () => {
  assert.equal(resolveSeatDecisionOutcome("approved"), "accepted");
  assert.equal(resolveSeatDecisionOutcome("awaiting_payment"), "accepted_awaiting_payment");
  assert.equal(resolveSeatDecisionOutcome("rejected"), "declined");
  assert.equal(resolveSeatDecisionOutcome("expired"), "declined");
});
