import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeSeminarChanges } from '../utils/seminarChanges';

const T0 = '2026-08-01T15:00:00.000Z';
const T1 = '2026-08-02T15:00:00.000Z';

const before = { name: 'Algebra', start: T0, duration: 60, price: 50, timezone: 'UTC' };

test('reports nothing when no material field changed', () => {
    assert.deepEqual(describeSeminarChanges(before, {}), []);
    // Fields resubmitted unchanged must not notify.
    assert.deepEqual(
        describeSeminarChanges(before, { start: new Date(T0), duration: 60, price: 50 }),
        [],
    );
});

test('ignores cosmetic edits (name/description/image)', () => {
    assert.deepEqual(describeSeminarChanges(before, { name: 'Algebra II', description: 'new', image: 'x.png' }), []);
});

test('reports a time change', () => {
    const out = describeSeminarChanges(before, { start: new Date(T1) });
    assert.equal(out.length, 1);
    assert.match(out[0], /^Time:/);
});

test('reports a price change with old and new amounts', () => {
    const out = describeSeminarChanges(before, { price: 75 });
    assert.deepEqual(out, ['Price: $50 → $75']);
});

test('reports a duration change', () => {
    assert.deepEqual(describeSeminarChanges(before, { duration: 90 }), ['Duration: 60 min → 90 min']);
});

test('reports multiple simultaneous changes', () => {
    const out = describeSeminarChanges(before, { start: new Date(T1), price: 75, duration: 90 });
    assert.equal(out.length, 3);
});

test('ignores an unparseable start rather than emitting a garbage notice', () => {
    assert.deepEqual(describeSeminarChanges(before, { start: 'not-a-date' }), []);
});
