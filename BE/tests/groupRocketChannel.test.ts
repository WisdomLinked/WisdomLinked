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
