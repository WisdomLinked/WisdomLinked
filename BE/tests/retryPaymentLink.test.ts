import test from "node:test";
import assert from "node:assert/strict";
import {
    RETRY_LINK_LIFETIME_MS,
    RETRY_LINK_SESSION_STARTED,
    RETRY_LINK_SESSION_TOO_SOON,
    checkoutPaymentMetadata,
    retryLinkExpiry,
} from "../utils/retryPaymentLink";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

test("a payment with no session behind it expires 24 hours after it is sent", () => {
    assert.deepEqual(retryLinkExpiry(NOW, null), { ok: true, expiresAtMs: NOW + RETRY_LINK_LIFETIME_MS });
    assert.deepEqual(retryLinkExpiry(NOW, undefined), { ok: true, expiresAtMs: NOW + 24 * HOUR });
});

test("a session more than a day away still gets exactly 24 hours", () => {
    assert.deepEqual(retryLinkExpiry(NOW, new Date(NOW + 5 * 24 * HOUR)), { ok: true, expiresAtMs: NOW + 24 * HOUR });
});

test("a session starting within the day ends the link at its start", () => {
    const start = NOW + 3 * HOUR;
    assert.deepEqual(retryLinkExpiry(NOW, new Date(start)), { ok: true, expiresAtMs: start });
    assert.deepEqual(retryLinkExpiry(NOW, new Date(start).toISOString()), { ok: true, expiresAtMs: start });
});

test("a session that has already started cannot be sent a link", () => {
    assert.deepEqual(retryLinkExpiry(NOW, new Date(NOW - MIN)), { ok: false, message: RETRY_LINK_SESSION_STARTED });
    assert.deepEqual(retryLinkExpiry(NOW, new Date(NOW)), { ok: false, message: RETRY_LINK_SESSION_STARTED });
});

test("a session starting in under Stripe's 30-minute minimum cannot be sent a link", () => {
    assert.deepEqual(retryLinkExpiry(NOW, new Date(NOW + 20 * MIN)), { ok: false, message: RETRY_LINK_SESSION_TOO_SOON });
    assert.deepEqual(retryLinkExpiry(NOW, new Date(NOW + 30 * MIN)), { ok: false, message: RETRY_LINK_SESSION_TOO_SOON });
    assert.equal(retryLinkExpiry(NOW, new Date(NOW + 31 * MIN)).ok, true);
});

test("an unreadable session start is treated as no session", () => {
    assert.deepEqual(retryLinkExpiry(NOW, "not a date"), { ok: true, expiresAtMs: NOW + 24 * HOUR });
});

test("checkout metadata comes from the Payment Link for older links, else from the session", () => {
    const fromLink = { paymentType: "retry", originalPaymentHistoryId: "old" };
    const fromSession = { paymentType: "retry", originalPaymentHistoryId: "new" };
    assert.deepEqual(checkoutPaymentMetadata({ metadata: fromSession }, fromLink), fromLink);
    assert.deepEqual(checkoutPaymentMetadata({ metadata: fromSession }, null), fromSession);
    assert.deepEqual(checkoutPaymentMetadata({ metadata: fromSession }, {}), fromSession);
    assert.deepEqual(checkoutPaymentMetadata({}, null), {});
    assert.deepEqual(checkoutPaymentMetadata(null, undefined), {});
});
