import test from 'node:test';
import assert from 'node:assert/strict';
import { membershipNoun, membershipNotice } from '../utils/membershipNotice';

test('join and leave lines name the kind of chat they happened in', () => {
    assert.equal(membershipNotice('Priya', 'join', 'community'), 'Priya has joined the community.');
    assert.equal(membershipNotice('Priya', 'join', 'seminar'), 'Priya has joined the seminar.');
    assert.equal(membershipNotice('Priya', 'join', 'individual'), 'Priya has joined the 1:1 appointment.');
    assert.equal(membershipNotice('Priya', 'leave', 'seminar'), 'Priya has left the seminar.');
    assert.equal(membershipNotice('Priya', 'leave', 'individual'), 'Priya has left the 1:1 appointment.');
});

test('an unknown or missing chat type keeps the original community wording', () => {
    assert.equal(membershipNoun(undefined), 'community');
    assert.equal(membershipNoun(null), 'community');
    assert.equal(membershipNoun('something-else'), 'community');
    assert.equal(membershipNotice('Sam', 'leave'), 'Sam has left the community.');
});
