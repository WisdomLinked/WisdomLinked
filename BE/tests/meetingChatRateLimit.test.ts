import test from 'node:test';
import assert from 'node:assert/strict';
import { allowMeetingChatRate } from '../utils/meetingChatRateLimit';

test('meeting chat rate limit allows under cap', () => {
    const key = `rl-test-${Date.now()}`;
    assert.equal(allowMeetingChatRate(key, 3, 60_000), true);
    assert.equal(allowMeetingChatRate(key, 3, 60_000), true);
    assert.equal(allowMeetingChatRate(key, 3, 60_000), true);
    assert.equal(allowMeetingChatRate(key, 3, 60_000), false);
});
