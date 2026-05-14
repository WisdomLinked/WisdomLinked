import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeMeetingChatLine, encodeMeetingChatLine } from '../utils/meetingChatPayload';

test('meetingChatPayload round-trips encode/decode', () => {
    const line = encodeMeetingChatLine('507f1f77bcf86cd799439011', {
        v: 1,
        author: 'Alice',
        guest: false,
        msg: 'Hello from the call',
    });
    const decoded = decodeMeetingChatLine(line);
    assert.ok(decoded);
    assert.equal(decoded!.meetingThreadId, '507f1f77bcf86cd799439011');
    assert.deepEqual(decoded!.payload, {
        v: 1,
        author: 'Alice',
        guest: false,
        msg: 'Hello from the call',
    });
});

test('meetingChatPayload returns null for garbage', () => {
    assert.equal(decodeMeetingChatLine('hello'), null);
    assert.equal(decodeMeetingChatLine('__MEETING_CHAT__::'), null);
    assert.equal(decodeMeetingChatLine('__MEETING_CHAT__::id::not-valid-b64!!!'), null);
});

test('meetingChatPayload round-trip with guest true', () => {
    const line = encodeMeetingChatLine('507f1f77bcf86cd799439011', {
        v: 1,
        author: 'Guest',
        guest: true,
        msg: 'Hi from meet',
    });
    const decoded = decodeMeetingChatLine(line);
    assert.ok(decoded);
    assert.equal(decoded!.payload.guest, true);
    assert.equal(decoded!.payload.msg, 'Hi from meet');
});
