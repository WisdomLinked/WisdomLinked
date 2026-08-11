import test from "node:test";
import assert from "node:assert/strict";

import {
  DECISION_NOTICE_TTL_MS,
  decisionNoticeCutoff,
  decisionNoticeExpiresAt,
  decisionNoticeIsVisible,
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
