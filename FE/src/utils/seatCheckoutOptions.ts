import type { WalletOption } from '../components/dashboard/StudentBookingCheckout';

/**
 * How an approved seat may be paid for.
 *
 * A wallet request skipped the card hold every card booking makes, so it settles the
 * same way it was requested. A student who joined the waitlist or was invited by the
 * host never chose a method, so nothing is pinned for them. Mirrors seatSettlementMode
 * on the server: if the two disagree, the payment form cannot confirm the payment.
 */
export const seatWalletOption = (origin?: string, requestedMode?: string): WalletOption =>
  String(origin || 'student') !== 'host' && requestedMode === 'wallet'
    ? { kind: 'charge', only: true }
    : { kind: 'charge' };

export const seatWasInvited = (origin?: string): boolean =>
  String(origin || 'student') === 'host';
