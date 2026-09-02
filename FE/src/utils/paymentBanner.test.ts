import { describe, expect, it } from 'vitest';
import { paymentBannerMessage, stripeTransactionId } from './paymentBanner';

describe('paymentBannerMessage', () => {
  it('calls a captured payment a payment', () => {
    expect(paymentBannerMessage({ kind: 'paid' })).toBe('Payment successful.');
    expect(paymentBannerMessage({ kind: 'paid', forWhat: "you're registered for Research Methods" })).toBe(
      "Payment successful — you're registered for Research Methods.",
    );
  });

  it('calls an authorization withheld, never paid', () => {
    const message = paymentBannerMessage({
      kind: 'withheld',
      amount: 59,
      deciderName: 'Bruce Wang',
    });

    expect(message).toMatch(/^Payment withheld/);
    expect(message).toContain('$59.00');
    expect(message).toContain('not charged');
    expect(message).toContain('Bruce Wang');
    expect(message).not.toMatch(/payment successful/i);
  });

  it('says who a wallet request is waiting on, and that nothing was taken', () => {
    const message = paymentBannerMessage({ kind: 'requestSent', deciderName: 'Bruce Wang' });

    expect(message).toBe(
      'Request sent for Bruce Wang to accept. Nothing has been charged yet.',
    );
    expect(message).not.toMatch(/payment successful|withheld/i);
  });

  it('never claims money moved unless it did', () => {
    const notPaid = [
      paymentBannerMessage({ kind: 'withheld', amount: 20, deciderName: 'X' }),
      paymentBannerMessage({ kind: 'requestSent', deciderName: 'X' }),
    ];

    for (const message of notPaid) {
      expect(message).not.toMatch(/payment successful/i);
      expect(message).not.toMatch(/\bpaid\b/i);
    }
  });

  it('falls back to a role rather than printing an empty name', () => {
    expect(paymentBannerMessage({ kind: 'requestSent', deciderName: '   ' })).toBe(
      'Request sent for the expert to accept. Nothing has been charged yet.',
    );
    expect(paymentBannerMessage({ kind: 'withheld', amount: 5 })).toContain('The expert has to accept');
  });

  it('carries the Stripe transaction id when there is one to quote', () => {
    expect(
      paymentBannerMessage({ kind: 'paid', forWhat: 'your seat is confirmed', transactionId: 'pi_3ABC' }),
    ).toBe('Payment successful — your seat is confirmed. Transaction ID: pi_3ABC');

    // Nothing was captured, so there is no transaction to quote.
    expect(paymentBannerMessage({ kind: 'paid', transactionId: '  ' })).toBe('Payment successful.');
  });

  it('treats the free-booking sentinel as no transaction at all', () => {
    // Free bookings never reach Stripe; the checkout calls back with '0'.
    expect(stripeTransactionId('0')).toBe('');
    expect(stripeTransactionId(null)).toBe('');
    expect(stripeTransactionId(undefined)).toBe('');
    expect(stripeTransactionId('  ')).toBe('');
    expect(stripeTransactionId('pi_3ABC123')).toBe('pi_3ABC123');
  });
});
