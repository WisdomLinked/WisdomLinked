import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRocketChannelKey } from '../utils/groupRocketChannel';

test('groupRocketChannelKey prefers seriesId over occurrence _id', () => {
    assert.equal(
        groupRocketChannelKey({
            _id: 'occ-aaaaaaaaaaaaaaaaaaaaaaa',
            seriesId: 'seriesbbbbbbbbbbbbbbbbbbb',
        }),
        'seriesbbbbbbbbbbbbbbbbbbb',
    );
});

test('groupRocketChannelKey falls back to _id when no series', () => {
    assert.equal(
        groupRocketChannelKey({ _id: 'communitycccccccccccccccccc' }),
        'communitycccccccccccccccccc',
    );
});

test('groupRocketChannelKey uses fallbackId when doc missing', () => {
    assert.equal(groupRocketChannelKey(null, 'fallbackdddddddddddddddddd'), 'fallbackdddddddddddddddddd');
    assert.equal(groupRocketChannelKey(undefined, ''), '');
});

test('resolveGroupMeetingScopeIds returns occurrence ids for a series', async () => {
    const GroupChat = require('../models/GroupChat');
    const originalFind = GroupChat.find;
    try {
        GroupChat.find = () => ({
            select: () => ({
                lean: async () => [{ _id: 'occ-a' }, { _id: 'occ-b' }],
            }),
        });
        const { resolveGroupMeetingScopeIds } = await import('../utils/groupRocketChannel');
        const ids = await resolveGroupMeetingScopeIds({
            _id: 'occ-a',
            seriesId: 'series-1',
        });
        assert.deepEqual(ids, ['occ-a', 'occ-b']);
    } finally {
        GroupChat.find = originalFind;
    }
});

test('resolveGroupMeetingScopeIds returns single id without series', async () => {
    const { resolveGroupMeetingScopeIds } = await import('../utils/groupRocketChannel');
    const ids = await resolveGroupMeetingScopeIds({ _id: 'community-1' });
    assert.deepEqual(ids, ['community-1']);
});
