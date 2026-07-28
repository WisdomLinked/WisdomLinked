import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePendingPayment, resolveOrphanedIntent } from '../utils/pendingPayment';

const state = (over: Partial<Parameters<typeof resolvePendingPayment>[0]> = {}) => ({
    captured: false,
    stillAuthorized: false,
    ownedByOpenSeatRequest: false,
    enrolled: false,
    ...over,
});

test('a captured intent for an enrolled student settles the stranded row', () => {
    assert.equal(resolvePendingPayment(state({ captured: true, enrolled: true })), 'settle');
});

test('a capture whose response was lost, leaving no enrollment, is refunded', () => {
    // The student was charged but never got a seat, so this must not become revenue.
    assert.equal(resolvePendingPayment(state({ captured: true, enrolled: false })), 'refund');
});

test('an abandoned hold is released rather than parked until Stripe expiry', () => {
    assert.equal(resolvePendingPayment(state({ stillAuthorized: true })), 'release');
});

test('release does not depend on enrollment, which cannot happen without a capture', () => {
    assert.equal(resolvePendingPayment(state({ stillAuthorized: true, enrolled: true })), 'release');
});

test('an intent that is neither captured nor held has failed', () => {
    assert.equal(resolvePendingPayment(state()), 'fail');
});

const orphan = (over: Partial<Parameters<typeof resolveOrphanedIntent>[0]> = {}) => ({
    status: 'requires_capture',
    recorded: false,
    heldByRequest: false,
    enrolled: false,
    ...over,
});

test('resolveOrphanedIntent skips intents that already have a record or an open request', () => {
    assert.equal(resolveOrphanedIntent(orphan({ recorded: true })), 'skip');
    assert.equal(resolveOrphanedIntent(orphan({ status: 'succeeded', recorded: true, enrolled: true })), 'skip');
    assert.equal(resolveOrphanedIntent(orphan({ heldByRequest: true })), 'skip');
});

test('resolveOrphanedIntent releases a stranded hold (no charge to the student)', () => {
    assert.equal(resolveOrphanedIntent(orphan({ status: 'requires_capture' })), 'release');
});

test('resolveOrphanedIntent records a captured intent only when the student is enrolled', () => {
    assert.equal(resolveOrphanedIntent(orphan({ status: 'succeeded', enrolled: true })), 'record');
    assert.equal(resolveOrphanedIntent(orphan({ status: 'succeeded', enrolled: false })), 'refund');
});

test('resolveOrphanedIntent ignores intents in any other Stripe status', () => {
    assert.equal(resolveOrphanedIntent(orphan({ status: 'canceled' })), 'skip');
    assert.equal(resolveOrphanedIntent(orphan({ status: 'processing' })), 'skip');
});

test('a hold awaiting a host decision is never touched by the sweep', () => {
    // The approval flow owns these rows until it approves, rejects, or expires them.
    for (const captured of [true, false]) {
        for (const stillAuthorized of [true, false]) {
            for (const enrolled of [true, false]) {
                assert.equal(
                    resolvePendingPayment(state({
                        captured,
                        stillAuthorized,
                        enrolled,
                        ownedByOpenSeatRequest: true,
                    })),
                    'wait',
                );
            }
        }
    }
});
