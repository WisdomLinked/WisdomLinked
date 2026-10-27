import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentSummary, isAutoClosedMeeting } from '../utils/appointmentActivity';

const HOUR = 60 * 60 * 1000;
const MAX = 12 * HOUR;
const start = new Date('2026-10-01T15:00:00.000Z');
const end = new Date('2026-10-01T15:30:00.000Z');
const at = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

test('a call the site closed itself is recognised, by flag or by lasting the whole limit', () => {
    assert.equal(isAutoClosedMeeting({ status: 'ended', duration: 60, autoClosed: true }, MAX), true);
    assert.equal(isAutoClosedMeeting({ status: 'ended', duration: MAX / 1000 }, MAX), true);
    assert.equal(isAutoClosedMeeting({ status: 'ended', duration: 29 * 60 }, MAX), false);
    assert.equal(isAutoClosedMeeting({ status: 'active', duration: 0 }, MAX), false);
});

test('call time is compared with the booked time', () => {
    const summary = appointmentSummary({
        appointment: { start, end, duration: 30 },
        meetings: [{ status: 'ended', startedAt: at(1), duration: 29 * 60 + 10 }],
        messages: [],
        maxActiveMs: MAX,
    });
    assert.equal(summary.bookedMinutes, 30);
    assert.equal(summary.calledMinutes, 29);
    assert.equal(summary.timeStatus, 'recorded');
    assert.equal(summary.callsDuring, 1);
    assert.equal(summary.callsAfter, 0);
});

test('a dropped and rejoined call adds up', () => {
    const summary = appointmentSummary({
        appointment: { start, end, duration: 30 },
        meetings: [
            { status: 'ended', startedAt: at(0), duration: 10 * 60 },
            { status: 'ended', startedAt: at(12), duration: 17 * 60 },
        ],
        messages: [],
        maxActiveMs: MAX,
    });
    assert.equal(summary.calledMinutes, 27);
    assert.equal(summary.callsDuring, 2);
});

test('a call that was never ended properly makes the time unconfirmed and adds nothing', () => {
    const summary = appointmentSummary({
        appointment: { start, end, duration: 30 },
        meetings: [
            { status: 'ended', startedAt: at(0), duration: 5 * 60 },
            { status: 'ended', startedAt: at(6), duration: MAX / 1000 },
        ],
        messages: [],
        maxActiveMs: MAX,
    });
    assert.equal(summary.timeStatus, 'unconfirmed');
    assert.equal(summary.calledMinutes, 5);
});

test('no call and a call still running are reported as such', () => {
    const none = appointmentSummary({ appointment: { start, end, duration: 30 }, meetings: [], messages: [], maxActiveMs: MAX });
    assert.equal(none.timeStatus, 'no-call');
    assert.equal(none.calledMinutes, 0);
    const live = appointmentSummary({
        appointment: { start, end, duration: 30 },
        meetings: [{ status: 'active', startedAt: at(2), duration: 0 }],
        messages: [],
        maxActiveMs: MAX,
    });
    assert.equal(live.timeStatus, 'in-progress');
});

test('calls and messages after the booked end are counted separately', () => {
    const summary = appointmentSummary({
        appointment: { start, end, duration: 30 },
        meetings: [
            { status: 'ended', startedAt: at(0), duration: 30 * 60 },
            { status: 'ended', startedAt: at(90), duration: 15 * 60 },
        ],
        messages: [
            { msg: 'before', ts: at(10).toISOString(), u: { username: 'a' } },
            { msg: 'after', ts: at(45).toISOString(), u: { username: 'a' } },
            { msg: 'after too', ts: { $date: at(200).getTime() }, u: { username: 'b' } },
            { msg: 'b', t: 'uj', ts: at(60).toISOString() },
            { msg: '__MEETING_ENDED__::x', ts: at(105).toISOString() },
        ],
        maxActiveMs: MAX,
    });
    assert.equal(summary.callsDuring, 1);
    assert.equal(summary.callsAfter, 1);
    assert.equal(summary.calledMinutes, 30, 'a later call does not count towards the appointment');
    assert.equal(summary.messagesAfter, 2);
    assert.equal(summary.scheduledEnd, end.toISOString());
});

test('booked time falls back to start and end, and unreadable history stays unknown', () => {
    const summary = appointmentSummary({ appointment: { start, end }, meetings: [], messages: null, maxActiveMs: MAX });
    assert.equal(summary.bookedMinutes, 30);
    assert.equal(summary.messagesAfter, null);
    const noEnd = appointmentSummary({ appointment: { start, duration: 45 }, meetings: [], messages: [], maxActiveMs: MAX });
    assert.equal(noEnd.scheduledEnd, at(45).toISOString());
});
