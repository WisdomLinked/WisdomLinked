import test from "node:test";
import assert from "node:assert/strict";
import {
    LOGIN_ATTEMPT_WINDOW_MS,
    LOGIN_LOCK_MS,
    MAX_LOGIN_ATTEMPTS,
    activeLoginLock,
    attemptsLeft,
    attemptsLeftSentence,
    countedFailures,
    lockRemainingMs,
    lockedMessage,
    minutesUntil,
    shouldLock,
} from "../utils/loginAttempts";

const NOW = Date.parse("2026-11-02T12:00:00Z");

test("five tries, then a fifteen-minute lock", () => {
    assert.equal(MAX_LOGIN_ATTEMPTS, 5);
    assert.equal(LOGIN_LOCK_MS, 15 * 60 * 1000);
});

test("tries left counts down from five and never goes negative", () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(attemptsLeft), [5, 4, 3, 2, 1, 0, 0]);
    assert.equal(attemptsLeft(Number.NaN), 5);
});

test("the fifth wrong try locks, earlier ones do not", () => {
    assert.deepEqual([1, 2, 3, 4].map(shouldLock), [false, false, false, false]);
    assert.equal(shouldLock(5), true);
    assert.equal(shouldLock(7), true);
});

test("a lock in the future is reported with its remaining time", () => {
    assert.equal(lockRemainingMs({ lockUntil: new Date(NOW + 90_000) }, NOW), 90_000);
    assert.equal(lockRemainingMs({ lockUntil: new Date(NOW + 90_000).toISOString() }, NOW), 90_000);
});

test("no lock, a run-out lock, or garbage means the step is open", () => {
    assert.equal(lockRemainingMs(null, NOW), 0);
    assert.equal(lockRemainingMs({}, NOW), 0);
    assert.equal(lockRemainingMs({ lockUntil: new Date(NOW) }, NOW), 0);
    assert.equal(lockRemainingMs({ lockUntil: new Date(NOW - 1) }, NOW), 0);
    assert.equal(lockRemainingMs({ lockUntil: "not a date" }, NOW), 0);
});

test("recent wrong tries are counted", () => {
    assert.equal(countedFailures({ failures: 3, lastFailedAt: new Date(NOW - 60_000) }, NOW), 3);
});

test("wrong tries still count while the lock is running", () => {
    assert.equal(
        countedFailures({ failures: 5, lockUntil: new Date(NOW + 1000), lastFailedAt: new Date(NOW - 1000) }, NOW),
        5
    );
});

test("once a lock runs out the user is back to a full set of tries", () => {
    assert.equal(
        countedFailures({ failures: 5, lockUntil: new Date(NOW - 1), lastFailedAt: new Date(NOW - LOGIN_LOCK_MS) }, NOW),
        0
    );
});

test("wrong tries older than the window are forgotten", () => {
    const old = { failures: 4, lastFailedAt: new Date(NOW - LOGIN_ATTEMPT_WINDOW_MS - 1) };
    assert.equal(countedFailures(old, NOW), 0);
    const edge = { failures: 4, lastFailedAt: new Date(NOW - LOGIN_ATTEMPT_WINDOW_MS) };
    assert.equal(countedFailures(edge, NOW), 4);
});

test("missing or nonsense state counts as no wrong tries", () => {
    assert.equal(countedFailures(null, NOW), 0);
    assert.equal(countedFailures({ failures: 3 }, NOW), 0);
    assert.equal(countedFailures({ failures: -2, lastFailedAt: new Date(NOW) }, NOW), 0);
    assert.equal(countedFailures({ failures: "x" as any, lastFailedAt: new Date(NOW) }, NOW), 0);
});

test("minutes round up and never read zero while locked", () => {
    assert.equal(minutesUntil(LOGIN_LOCK_MS), 15);
    assert.equal(minutesUntil(14 * 60 * 1000 + 1), 15);
    assert.equal(minutesUntil(1000), 1);
    assert.equal(minutesUntil(0), 1);
});

test("the tries-left sentence uses the right plural", () => {
    assert.equal(attemptsLeftSentence(4), "You have 4 attempts left.");
    assert.equal(attemptsLeftSentence(1), "You have 1 attempt left.");
});

test("the lock message names the step and the wait", () => {
    assert.equal(lockedMessage("password", LOGIN_LOCK_MS), "Too many failed sign-in attempts. Please try again in 15 minutes.");
    assert.equal(lockedMessage("otp", 30_000), "Too many incorrect codes. Please try again in 1 minute.");
});

test("an account's running lock names its step and end; run-out or missing locks give null", () => {
    const until = new Date(NOW + 5 * 60_000);
    assert.deepEqual(activeLoginLock({ password: { lockUntil: until }, otp: {} }, NOW), { step: "password", lockedUntil: until });
    assert.equal(activeLoginLock({ password: { lockUntil: new Date(NOW - 1) }, otp: { lockUntil: null } }, NOW), null);
    assert.equal(activeLoginLock(null, NOW), null);
    assert.equal(activeLoginLock({}, NOW), null);
});

test("with both steps locked, the lock that ends last is reported", () => {
    const soon = new Date(NOW + 60_000);
    const later = new Date(NOW + 10 * 60_000);
    assert.deepEqual(activeLoginLock({ password: { lockUntil: soon }, otp: { lockUntil: later } }, NOW), { step: "otp", lockedUntil: later });
    assert.deepEqual(activeLoginLock({ password: { lockUntil: later }, otp: { lockUntil: soon } }, NOW), { step: "password", lockedUntil: later });
});
