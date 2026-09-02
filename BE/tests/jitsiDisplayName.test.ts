import test from 'node:test';
import assert from 'node:assert/strict';
import { jitsiDisplayInitials } from '../utils/jitsiDisplayName';

test('jitsiDisplayInitials uses first and last initial for multi-word names', () => {
    assert.equal(jitsiDisplayInitials({ username: 'Khussal Pradhan' }), 'KP');
});

test('jitsiDisplayInitials uses first two letters for single token', () => {
    assert.equal(jitsiDisplayInitials({ username: 'Alice' }), 'AL');
});

test('jitsiDisplayInitials derives from email when username missing', () => {
    assert.equal(jitsiDisplayInitials({ email: 'khussal.tamu@edu' }), 'KT');
});
