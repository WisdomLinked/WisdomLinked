import test from 'node:test';
import assert from 'node:assert/strict';
import {
    signGuestMeetingChatToken,
    signWlMeetingChatToken,
    verifyMeetingChatToken,
} from '../utils/meetingChatSyncToken';

test('meeting chat token wl round-trip', () => {
    const prev = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'unit-test-meeting-chat-secret';
    try {
        const t = signWlMeetingChatToken('user-1', 'meet-1', 600);
        const v = verifyMeetingChatToken(t);
        assert.ok(v && v.typ === 'wl-meeting-chat');
        if (v.typ === 'wl-meeting-chat') {
            assert.equal(v.sub, 'user-1');
            assert.equal(v.mid, 'meet-1');
        }
    } finally {
        process.env.JWT_SECRET = prev;
    }
});

test('meeting chat token guest round-trip', () => {
    const prev = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'unit-test-meeting-chat-secret';
    try {
        const t = signGuestMeetingChatToken('inv-1', 'meet-2', 'Guest participant', 600);
        const v = verifyMeetingChatToken(t);
        assert.ok(v && v.typ === 'guest-meeting-chat');
        if (v.typ === 'guest-meeting-chat') {
            assert.equal(v.inv, 'inv-1');
            assert.equal(v.mid, 'meet-2');
            assert.equal(v.nm, 'Guest participant');
        }
    } finally {
        process.env.JWT_SECRET = prev;
    }
});

test('meeting chat token rejects garbage', () => {
    const prev = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'unit-test-meeting-chat-secret';
    try {
        assert.equal(verifyMeetingChatToken('not-a-jwt'), null);
    } finally {
        process.env.JWT_SECRET = prev;
    }
});
