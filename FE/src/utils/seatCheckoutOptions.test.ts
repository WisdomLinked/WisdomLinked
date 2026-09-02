import { describe, expect, it } from 'vitest';
import { seatWalletOption, seatWasInvited } from './seatCheckoutOptions';

describe('seatWalletOption', () => {
  it('pins a student-requested seat to the method it was requested in', () => {
    expect(seatWalletOption('student')).toEqual({ kind: 'charge', only: true });
    expect(seatWalletOption(undefined)).toEqual({ kind: 'charge', only: true });
    expect(seatWalletOption('')).toEqual({ kind: 'charge', only: true });
  });

  it('leaves a host invitation unpinned, because the student never chose', () => {
    expect(seatWalletOption('host')).toEqual({ kind: 'charge' });
    expect((seatWalletOption('host') as any).only).toBeUndefined();
  });

  it('reads the origin the same way everywhere', () => {
    expect(seatWasInvited('host')).toBe(true);
    expect(seatWasInvited('student')).toBe(false);
    expect(seatWasInvited(undefined)).toBe(false);
  });
});
