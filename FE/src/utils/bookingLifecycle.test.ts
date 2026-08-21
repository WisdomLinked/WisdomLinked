import { describe, expect, it } from 'vitest';

import {
  awaitsWalletPayment,
  awaitsExpertDecision,
  pendingRequestIsLive,
  paymentWindowOpen,
} from './bookingLifecycle';

const NOW = Date.parse('2026-08-14T12:00:00Z');
const inHours = (h: number) => new Date(NOW + h * 3600_000).toISOString();

const walletChat = (over: Record<string, unknown> = {}) => ({
  paymentMode: 'wallet',
  status: 'pending',
  paymentDeadline: inHours(24),
  ...over,
});

describe('awaitsWalletPayment', () => {
  it('is true once the expert accepted and the window is open', () => {
    expect(awaitsWalletPayment(walletChat(), NOW)).toBe(true);
  });

  it('is false before the expert has accepted', () => {
    // No deadline means no acceptance — this is still the expert's to decide.
    expect(awaitsWalletPayment(walletChat({ paymentDeadline: null }), NOW)).toBe(false);
  });

  it('is false once the window has lapsed', () => {
    expect(awaitsWalletPayment(walletChat({ paymentDeadline: inHours(-1) }), NOW)).toBe(false);
  });

  it('is false for a card booking, which is confirmed on acceptance', () => {
    expect(awaitsWalletPayment(walletChat({ paymentMode: 'card' }), NOW)).toBe(false);
    expect(awaitsWalletPayment(walletChat({ paymentMode: undefined }), NOW)).toBe(false);
  });

  it('is false once the session is confirmed or cancelled', () => {
    expect(awaitsWalletPayment(walletChat({ status: 'active' }), NOW)).toBe(false);
    expect(awaitsWalletPayment(walletChat({ status: 'cancelled' }), NOW)).toBe(false);
  });

  it('tolerates missing or malformed input', () => {
    expect(awaitsWalletPayment(null, NOW)).toBe(false);
    expect(awaitsWalletPayment(undefined, NOW)).toBe(false);
    expect(awaitsWalletPayment(walletChat({ paymentDeadline: 'not a date' }), NOW)).toBe(false);
  });
});

describe('awaitsExpertDecision', () => {
  it('excludes a wallet request the expert already accepted', () => {
    // This was the bug: it stayed in the expert's pending list, and pressing accept
    // failed with "You have already accepted this request".
    expect(awaitsExpertDecision(walletChat(), NOW)).toBe(false);
  });

  it('includes a wallet request still awaiting the expert', () => {
    expect(awaitsExpertDecision(walletChat({ paymentDeadline: null }), NOW)).toBe(true);
  });

  it('includes an ordinary pending card request', () => {
    expect(awaitsExpertDecision({ status: 'pending', paymentMode: 'card' }, NOW)).toBe(true);
  });

  it('returns a wallet booking to the expert once its window lapses', () => {
    // Unpaid in time: the sweep cancels it, but until then it is not awaiting payment.
    expect(awaitsExpertDecision(walletChat({ paymentDeadline: inHours(-1) }), NOW)).toBe(true);
  });

  it('excludes anything no longer pending', () => {
    expect(awaitsExpertDecision({ status: 'active' }, NOW)).toBe(false);
    expect(awaitsExpertDecision({ status: 'cancelled' }, NOW)).toBe(false);
  });
});

describe('pendingRequestIsLive', () => {
  it('is true while the session is still ahead', () => {
    expect(pendingRequestIsLive({ start: inHours(2) }, NOW)).toBe(true);
  });

  it('is false once the session time has passed', () => {
    // The server refuses to accept or pay for these, so showing them as "waiting for
    // mentor approval" promises a decision that can never arrive.
    expect(pendingRequestIsLive({ start: inHours(-1) }, NOW)).toBe(false);
    expect(pendingRequestIsLive({ start: inHours(-500) }, NOW)).toBe(false);
  });

  it('keeps an undated request visible rather than silently dropping it', () => {
    expect(pendingRequestIsLive({}, NOW)).toBe(true);
    expect(pendingRequestIsLive({ start: null }, NOW)).toBe(true);
    expect(pendingRequestIsLive({ start: 'not a date' }, NOW)).toBe(true);
    expect(pendingRequestIsLive(null, NOW)).toBe(true);
  });
});

describe('paymentWindowOpen', () => {
  it('is true while the deadline is ahead', () => {
    expect(paymentWindowOpen({ paymentDeadline: inHours(4) }, NOW)).toBe(true);
  });

  it('is false once the deadline has passed', () => {
    expect(paymentWindowOpen({ paymentDeadline: inHours(-1) }, NOW)).toBe(false);
  });

  it('treats a booking with no deadline as still payable', () => {
    expect(paymentWindowOpen({}, NOW)).toBe(true);
    expect(paymentWindowOpen({ paymentDeadline: null }, NOW)).toBe(true);
    expect(paymentWindowOpen(null, NOW)).toBe(true);
  });

  it('does not close the window on an unreadable deadline', () => {
    expect(paymentWindowOpen({ paymentDeadline: 'not a date' }, NOW)).toBe(true);
  });
});
