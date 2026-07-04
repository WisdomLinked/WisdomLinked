import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    seminarIsFull,
    computeSeatRequestDeadline,
    seatRequestWindowOpen,
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

test('seminarIsFull is false when no capacity is set', () => {
    assert.equal(seminarIsFull({ admin: 'host', participants: ['host', 's1', 's2'] }), false);
    assert.equal(seminarIsFull({ admin: 'host', maxAttendees: 0, participants: ['host', 's1'] }), false);
});

test('computeSeatRequestDeadline uses the admin hours when it lands before the hold expiry', () => {
    const now = 1_000_000_000_000;
    const start = now + 3 * DAY;
    const deadline = computeSeatRequestDeadline(start, 24, now);
    assert.equal(deadline.getTime(), start - 24 * HOUR);
});

test('computeSeatRequestDeadline is capped by the 7-day hold expiry', () => {
    const now = 1_000_000_000_000;
    // Start is ~10 days out; hours-before would exceed the hold window, so the
    // hold expiry (now + 7d) wins.
    const start = now + 10 * DAY;
    const deadline = computeSeatRequestDeadline(start, 24, now);
    assert.equal(deadline.getTime(), now + SEAT_REQUEST_HOLD_MS);
});

test('seatRequestWindowOpen only allows future seminars within the hold window', () => {
    const now = 1_000_000_000_000;
    assert.equal(seatRequestWindowOpen(now - HOUR, now), false); // past
    assert.equal(seatRequestWindowOpen(now + 3 * DAY, now), true); // within 7 days
    assert.equal(seatRequestWindowOpen(now + 8 * DAY, now), false); // beyond 7 days
});
