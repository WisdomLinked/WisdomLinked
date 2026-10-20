import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    seminarIsFull,
    occupiedSeminarSeats,
    claimableSeatCap,
    hasCapacityLimit,
    firstFullFutureOccurrence,
    resolveSeatApprovalBlock,
    computeSeatRequestDeadline,
    seatRequestWindowOpen,
    seatRequestWindowState,
    seatRequestWindowOpensAt,
    seatRequestUnavailableMessage,
    isLegacyHeldSeatRequest,
    SEAT_REQUEST_HOLD_MS,
} from '../utils/seminarCapacity';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

test('seminarIsFull ignores the host and honors capacity', () => {
    const gc = { admin: 'host', maxAttendees: 2, participants: ['host', 's1'] };
    assert.equal(seminarIsFull(gc), false); // 1 enrolled student, cap 2
    gc.participants = ['host', 's1', 's2'];
    assert.equal(seminarIsFull(gc), true); // 2 enrolled students, cap 2
});

test('seminarIsFull counts soft-held awaiting_payment seats as occupied', () => {
    const gc = { admin: 'host', maxAttendees: 2, participants: ['host', 's1'] };
    assert.equal(seminarIsFull(gc, 0), false);
    assert.equal(seminarIsFull(gc, 1), true); // 1 enrolled + 1 soft hold = cap
    assert.equal(occupiedSeminarSeats(gc, 1), 2);
    assert.equal(claimableSeatCap(2, 1), 1);
    assert.equal(claimableSeatCap(2, 2), 0);
    assert.equal(claimableSeatCap(null, 5), null);
});

test('seminarIsFull is false when no capacity is set (unlimited)', () => {
    assert.equal(seminarIsFull({ admin: 'host', participants: ['host', 's1', 's2'] }), false);
    assert.equal(seminarIsFull({ admin: 'host', maxAttendees: null, participants: ['host', 's1'] }), false);
});

test('seminarIsFull treats a cap of 0 (or less) as closed, not unlimited', () => {
    assert.equal(seminarIsFull({ admin: 'host', maxAttendees: 0, participants: ['host'] }), true);
    assert.equal(seminarIsFull({ admin: 'host', maxAttendees: -3, participants: ['host'] }), true);
});

test('hasCapacityLimit distinguishes an unset cap from a numeric one', () => {
    assert.equal(hasCapacityLimit(null), false);
    assert.equal(hasCapacityLimit(undefined), false);
    assert.equal(hasCapacityLimit(0), true);
    assert.equal(hasCapacityLimit(5), true);
});

test('firstFullFutureOccurrence flags a full later session and ignores past/roomy ones', () => {
    const now = 1_000_000_000_000;
    const DAYMS = 24 * 60 * 60 * 1000;
    const past = { admin: 'host', maxAttendees: 2, participants: ['host', 's1', 's2'], start: now - DAYMS };
    const roomy = { admin: 'host', maxAttendees: 10, participants: ['host', 's1'], start: now + DAYMS };
    const full = { admin: 'host', maxAttendees: 2, participants: ['host', 's1', 's2'], start: now + 2 * DAYMS };

    assert.equal(firstFullFutureOccurrence([past, roomy], now), null);
    assert.equal(firstFullFutureOccurrence([roomy], now), null);
    assert.equal(firstFullFutureOccurrence([roomy, full], now), full);
    // A full session in the past no longer blocks a new registrant.
    assert.equal(firstFullFutureOccurrence([{ ...full, start: now - DAYMS }], now), null);
});

test('resolveSeatApprovalBlock lets a valid, still-open request through', () => {
    const now = 1_000_000_000_000;
    assert.equal(
        resolveSeatApprovalBlock({
            alreadyEnrolled: false,
            seminarStatus: 'active',
            startMs: now + 3 * DAY,
            deadlineMs: now + 2 * DAY,
            authorizedCents: 5000,
            currentPriceCents: 5000,
            nowMs: now,
        }),
        null,
    );
});

test('resolveSeatApprovalBlock blocks a price increase but allows a price drop', () => {
    const now = 1_000_000_000_000;
    const base = { alreadyEnrolled: false, seminarStatus: 'active', startMs: now + 3 * DAY, deadlineMs: now + 2 * DAY, nowMs: now };
    // Host raised $50 -> $80 after the hold: block (would undercharge).
    assert.equal(resolveSeatApprovalBlock({ ...base, authorizedCents: 5000, currentPriceCents: 8000 }), 'price_increased');
    // Host dropped $50 -> $30: allowed (capture the lower current price).
    assert.equal(resolveSeatApprovalBlock({ ...base, authorizedCents: 5000, currentPriceCents: 3000 }), null);
    // Unchanged price: allowed.
    assert.equal(resolveSeatApprovalBlock({ ...base, authorizedCents: 5000, currentPriceCents: 5000 }), null);
});

test('resolveSeatApprovalBlock blocks a free request the host later put a price on', () => {
    const now = 1_000_000_000_000;
    const base = { alreadyEnrolled: false, seminarStatus: 'active', startMs: now + 3 * DAY, deadlineMs: now + 2 * DAY, nowMs: now };
    // Requested while free (nothing authorized), host then charges $50: approving would
    // enrol the student for nothing, so make them re-request at the new price.
    assert.equal(resolveSeatApprovalBlock({ ...base, authorizedCents: 0, currentPriceCents: 5000 }), 'price_increased');
    // Still free: allowed.
    assert.equal(resolveSeatApprovalBlock({ ...base, authorizedCents: 0, currentPriceCents: 0 }), null);
});

test('resolveSeatApprovalBlock blocks approval into cancelled/started/expired/dup states', () => {
    const now = 1_000_000_000_000;
    const base = { alreadyEnrolled: false, seminarStatus: 'active', startMs: now + 3 * DAY, deadlineMs: now + 2 * DAY, nowMs: now };
    assert.equal(resolveSeatApprovalBlock({ ...base, alreadyEnrolled: true }), 'already_enrolled');
    assert.equal(resolveSeatApprovalBlock({ ...base, seminarStatus: 'cancelled' }), 'seminar_closed');
    assert.equal(resolveSeatApprovalBlock({ ...base, seminarStatus: 'draft' }), 'seminar_closed');
    assert.equal(resolveSeatApprovalBlock({ ...base, startMs: now - HOUR }), 'seminar_started');
    assert.equal(resolveSeatApprovalBlock({ ...base, deadlineMs: now - HOUR }), 'request_expired');
});

test('resolveSeatApprovalBlock checks dup before closed before started before expired', () => {
    const now = 1_000_000_000_000;
    // Everything is wrong at once — the most fundamental reason (already enrolled) wins.
    assert.equal(
        resolveSeatApprovalBlock({
            alreadyEnrolled: true,
            seminarStatus: 'cancelled',
            startMs: now - HOUR,
            deadlineMs: now - HOUR,
            nowMs: now,
        }),
        'already_enrolled',
    );
});

test('computeSeatRequestDeadline uses the admin hours when it lands before the hold expiry', () => {
    const now = 1_000_000_000_000;
    const start = now + 3 * DAY;
    const deadline = computeSeatRequestDeadline(start, 24, now);
    assert.equal(deadline.getTime(), start - 24 * HOUR);
});

test('computeSeatRequestDeadline never returns a past deadline for an imminent seminar', () => {
    const now = 1_000_000_000_000;
    // Seminar starts in 5 hours but the admin buffer is 24h — the buffer-based
    // deadline would be in the past, which would let the sweep expire a freshly
    // created request. It must fall back to the seminar start instead.
    const start = now + 5 * HOUR;
    const deadline = computeSeatRequestDeadline(start, 24, now);
    assert.equal(deadline.getTime(), start);
    assert.ok(deadline.getTime() > now, 'deadline must be in the future');
});

test('computeSeatRequestDeadline is capped by the 7-day hold expiry', () => {
    const now = 1_000_000_000_000;
    // Start is ~10 days out; hours-before would exceed the hold window, so the
    // hold expiry (now + 7d) wins.
    const start = now + 10 * DAY;
    const deadline = computeSeatRequestDeadline(start, 24, now);
    assert.equal(deadline.getTime(), now + SEAT_REQUEST_HOLD_MS);
});

test('seatRequestWindowOpen allows any future seminar (interest waitlist anytime)', () => {
    const now = 1_000_000_000_000;
    assert.equal(seatRequestWindowOpen(now - HOUR, now), false); // past
    assert.equal(seatRequestWindowOpen(now + 3 * DAY, now), true);
    assert.equal(seatRequestWindowOpen(now + 8 * DAY, now), true); // beyond old 7-day hold
    assert.equal(seatRequestWindowOpen(now + 30 * DAY, now), true);
});

test('seatRequestWindowState is open for future seminars (no too_early gate)', () => {
    const now = 1_000_000_000_000;
    assert.equal(seatRequestWindowState(now + 3 * DAY, now), 'open');
    assert.equal(seatRequestWindowState(now + SEAT_REQUEST_HOLD_MS, now), 'open');
    assert.equal(seatRequestWindowState(now + 8 * DAY, now), 'open');
    assert.equal(seatRequestWindowState(now - HOUR, now), 'closed');
    assert.equal(seatRequestWindowState(0, now), 'undated');
});

test('seatRequestWindowOpensAt still reports the legacy 7-day boundary', () => {
    const now = 1_000_000_000_000;
    const start = now + 30 * DAY;
    assert.equal(seatRequestWindowOpensAt(start), start - SEAT_REQUEST_HOLD_MS);
});

test('seatRequestUnavailableMessage is null far before start (join anytime)', () => {
    const now = Date.UTC(2026, 6, 28);
    const start = Date.UTC(2026, 7, 20);
    assert.equal(seatRequestUnavailableMessage(start, now), null);
});

test('seatRequestUnavailableMessage is null once the waiting list is open', () => {
    const now = 1_000_000_000_000;
    assert.equal(seatRequestUnavailableMessage(now + 3 * DAY, now), null);
});

test('seatRequestUnavailableMessage explains started seminars; undated is allowed', () => {
    const now = 1_000_000_000_000;
    assert.match(String(seatRequestUnavailableMessage(now - HOUR, now)), /already started/);
    assert.equal(seatRequestUnavailableMessage(0, now), null);
});

test('isLegacyHeldSeatRequest detects card holds and wallet-approval pending rows', () => {
    assert.equal(isLegacyHeldSeatRequest({ paymentIntent: 'pi_abc' }), true);
    assert.equal(isLegacyHeldSeatRequest({ paymentMode: 'wallet', amount: 5000 }), true);
    assert.equal(isLegacyHeldSeatRequest({ paymentMode: 'wallet', amount: 0 }), false);
    assert.equal(isLegacyHeldSeatRequest({ amount: 0 }), false);
    assert.equal(isLegacyHeldSeatRequest({}), false);
});
