import { describe, expect, it } from 'vitest';
import { seatWalletOption, seatWasInvited } from './seatCheckoutOptions';

describe('seatWalletOption', () => {
  it('pins a seat the student requested by wallet', () => {
    expect(seatWalletOption('student', 'wallet')).toEqual({ kind: 'charge', only: true });
    expect(seatWalletOption(undefined, 'wallet')).toEqual({ kind: 'charge', only: true });
    expect(seatWalletOption('', 'wallet')).toEqual({ kind: 'charge', only: true });
  });

  it('leaves a waitlisted student unpinned, because the default mode is not a choice', () => {
    expect(seatWalletOption('student', 'card')).toEqual({ kind: 'charge' });
    expect(seatWalletOption('student')).toEqual({ kind: 'charge' });
    expect(seatWalletOption(undefined)).toEqual({ kind: 'charge' });
  });

  it('leaves a host invitation unpinned, because the student never chose', () => {
    expect(seatWalletOption('host', 'wallet')).toEqual({ kind: 'charge' });
    expect(seatWalletOption('host')).toEqual({ kind: 'charge' });
    expect((seatWalletOption('host') as any).only).toBeUndefined();
  });

  it('reads the origin the same way everywhere', () => {
    expect(seatWasInvited('host')).toBe(true);
    expect(seatWasInvited('student')).toBe(false);
    expect(seatWasInvited(undefined)).toBe(false);
  });
});
