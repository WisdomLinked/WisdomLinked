import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeSeminarChanges, seminarDetailPairs } from '../utils/seminarChanges';

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

test('ignores description and image edits, but a retitle is material', () => {
    assert.deepEqual(describeSeminarChanges(before, { description: 'new', image: 'x.png' }), []);
    assert.deepEqual(
        describeSeminarChanges(before, { name: 'Algebra II', description: 'new', image: 'x.png' }),
        ['Title: Algebra → Algebra II'],
    );
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

test('reports a title change', () => {
    assert.deepEqual(describeSeminarChanges(before, { name: 'Algebra II' }), ['Title: Algebra → Algebra II']);
});

test('ignores a description edit on its own', () => {
    assert.deepEqual(describeSeminarChanges(before, { description: 'reworded' }), []);
});

test('ignores a title resubmitted unchanged, or blank', () => {
    assert.deepEqual(describeSeminarChanges(before, { name: 'Algebra' }), []);
    assert.deepEqual(describeSeminarChanges(before, { name: '   ' }), []);
});

test('reports a capacity change, and treats 0/absent as Unlimited', () => {
    assert.deepEqual(
        describeSeminarChanges({ ...before, maxAttendees: 10 }, { maxAttendees: 25 }),
        ['Max attendees: 10 → 25'],
    );
    assert.deepEqual(
        describeSeminarChanges({ ...before, maxAttendees: 10 }, { maxAttendees: 0 }),
        ['Max attendees: 10 → Unlimited'],
    );
    assert.deepEqual(describeSeminarChanges(before, { maxAttendees: 0 }), []);
});

test('seminarDetailPairs shows the post-edit values, falling back to the stored ones', () => {
    const pairs = seminarDetailPairs({ ...before, maxAttendees: 10 }, { price: 75 });
    const map = Object.fromEntries(pairs);
    assert.equal(map['Seminar'], 'Algebra');
    assert.equal(map['Price'], '$75');
    assert.equal(map['Duration'], '60 min');
    assert.equal(map['Max attendees'], '10');
});

test('seminarDetailPairs renders a zero price as Free and no capacity as Unlimited', () => {
    const map = Object.fromEntries(seminarDetailPairs({ ...before, price: 0 }));
    assert.equal(map['Price'], 'Free');
    assert.equal(map['Max attendees'], 'Unlimited');
});
