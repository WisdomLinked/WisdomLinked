import type { WalletOption } from '../components/dashboard/StudentBookingCheckout';

/**
 * How an approved seat may be paid for.
 *
 * A student who asked for the seat picked a method when they asked, and a wallet
 * request skipped the card hold every card booking makes — so it settles the same
 * way it was requested. A host's invitation carries no such choice: the student was
 * never asked, so nothing is pinned for them.
 */
export const seatWalletOption = (origin?: string): WalletOption =>
  String(origin || 'student') === 'host'
    ? { kind: 'charge' }
    : { kind: 'charge', only: true };

export const seatWasInvited = (origin?: string): boolean =>
  String(origin || 'student') === 'host';
