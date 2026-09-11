import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPayment, summarizePaymentHistory } from '../utils/paymentSummary';

const seminarCharge = (amount: number) => ({
    status: 'completed',
    paymentType: 'charge',
    amount,
    groupChat: { type: 'seminar' },
});

const seminarRefund = (amount: number, status: 'completed' | 'refunded' = 'completed') => ({
    status,
    paymentType: 'refund',
    amount,
    groupChat: { type: 'seminar' },
});

test('classifyPayment buckets by the linked record', () => {
    assert.equal(classifyPayment({ groupChat: { type: 'seminar' } }), 'seminar');
    assert.equal(classifyPayment({ groupChat: { type: 'individual' } }), 'individual');
    assert.equal(classifyPayment({ event: { title: 'x' } }), 'individual');
    assert.equal(classifyPayment({}), 'other');
});

test('a refunded seminar registration nets to zero', () => {
    // The charge row stays in history and a separate refund row is appended, so
    // treating both as income used to report 2x the fee as revenue.
    const summary = summarizePaymentHistory([seminarCharge(5000), seminarRefund(5000)]);
    assert.equal(summary.seminarsCents, 0);
    assert.equal(summary.totalReceivedCents, 0);
});

test('legacy both-refunded (flipped charge + refunded refund) still nets to zero', () => {
    const summary = summarizePaymentHistory([
        { status: 'refunded', paymentType: 'charge', amount: 20000, groupChat: { type: 'seminar' } },
        { status: 'refunded', paymentType: 'refund', amount: 20000, groupChat: { type: 'seminar' } },
    ]);
    assert.equal(summary.seminarsCents, 0);
    assert.equal(summary.totalReceivedCents, 0);
});

test('new full-refund shape (completed charge + refunded refund) nets to zero', () => {
    const summary = summarizePaymentHistory([
        seminarCharge(250),
        seminarRefund(250, 'refunded'),
    ]);
    assert.equal(summary.seminarsCents, 0);
    assert.equal(summary.totalReceivedCents, 0);
});

test('legacy refunded charge + completed refund washes to zero', () => {
    // Refunded charges are not income; matching refund rows are washed against them
    // so the old leftSeminar bookkeeping shape does not go negative.
    const summary = summarizePaymentHistory([
        { status: 'refunded', paymentType: 'charge', amount: 20000, groupChat: { type: 'seminar' } },
        { status: 'completed', paymentType: 'refund', amount: 20000, groupChat: { type: 'seminar' } },
    ]);
    assert.equal(summary.seminarsCents, 0);
    assert.equal(summary.totalReceivedCents, 0);
});

test('an admin full refund nets to zero, a partial refund leaves the remainder', () => {
    // processRefund leaves the charge completed and records the refund row as refunded
    // when the payment is fully returned.
    const full = summarizePaymentHistory([
        { status: 'completed', paymentType: 'charge', amount: 5000, groupChat: { type: 'seminar' } },
        { status: 'refunded', paymentType: 'refund', amount: 5000, groupChat: { type: 'seminar' } },
    ]);
    assert.equal(full.seminarsCents, 0);

    const partial = summarizePaymentHistory([
        { status: 'completed', paymentType: 'charge', amount: 5000, groupChat: { type: 'seminar' } },
        { status: 'completed', paymentType: 'refund', amount: 2000, groupChat: { type: 'seminar' } },
    ]);
    assert.equal(partial.seminarsCents, 3000);
});

test('refunds only offset their own bucket', () => {
    const summary = summarizePaymentHistory([
        seminarCharge(5000),
        seminarRefund(5000),
        { status: 'completed', paymentType: 'charge', amount: 2000, groupChat: { type: 'individual' } },
    ]);
    assert.equal(summary.seminarsCents, 0);
    assert.equal(summary.individualSessionsCents, 2000);
    assert.equal(summary.totalReceivedCents, 2000);
});

test('uncaptured holds and failed payments are not revenue', () => {
    const summary = summarizePaymentHistory([
        { status: 'pending', paymentType: 'charge', amount: 5000, groupChat: { type: 'seminar' } },
        { status: 'failed', paymentType: 'charge', amount: 5000, groupChat: { type: 'seminar' } },
        { status: 'refunded', paymentType: 'charge', amount: 5000, groupChat: { type: 'seminar' } },
    ]);
    assert.equal(summary.totalReceivedCents, 0);
});

test('a captured seminar payment counts once', () => {
    const summary = summarizePaymentHistory([seminarCharge(5000)]);
    assert.equal(summary.seminarsCents, 5000);
    assert.equal(summary.totalReceivedCents, 5000);
});

test('missing or malformed amounts are ignored, not NaN', () => {
    const summary = summarizePaymentHistory([
        { status: 'completed', paymentType: 'charge', groupChat: { type: 'seminar' } },
        { status: 'completed', paymentType: 'charge', amount: null, groupChat: { type: 'seminar' } },
        seminarCharge(1000),
    ]);
    assert.equal(summary.seminarsCents, 1000);
});
