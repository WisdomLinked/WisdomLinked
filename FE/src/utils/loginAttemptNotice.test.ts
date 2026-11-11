import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  isAttemptLimitReply,
  isBlockedAccountReply,
  blockReasonFromReply,
  splitContactAdminText,
  lockCountdownText,
  lockAfterStatusCheck,
  lockFromReply,
  lockRemainingMs,
} from './loginAttemptNotice';

const NOW = 1_000_000;

describe('isAttemptLimitReply', () => {
  it('is true for a wrong-try reply carrying the tries left', () => {
    expect(isAttemptLimitReply({ status: 'FAIL', error: 'x', attemptsLeft: 4 })).toBe(true);
    expect(isAttemptLimitReply({ status: 'FAIL', error: 'x', attemptsLeft: 0 })).toBe(true);
  });

  it('is false for other failures, successes and nothing', () => {
    expect(isAttemptLimitReply({ status: 'FAIL', error: 'Your account is blocked.' })).toBe(false);
    expect(isAttemptLimitReply({ status: 'FAIL', attemptsLeft: null })).toBe(false);
    expect(isAttemptLimitReply({ status: 'SUCCESS', attemptsLeft: 4 })).toBe(false);
    expect(isAttemptLimitReply(false)).toBe(false);
  });

  it('isBlockedAccountReply is true only for a refused sign-in with the blocked code', () => {
    expect(isBlockedAccountReply({ status: 'FAIL', error: 'x', code: 'USER_BLOCKED' })).toBe(true);
    expect(isBlockedAccountReply({ status: 'FAIL', error: 'x', code: 'UNDER_REVIEW' })).toBe(false);
    expect(isBlockedAccountReply({ status: 'FAIL', error: 'x', attemptsLeft: 4 })).toBe(false);
    expect(isBlockedAccountReply({ status: 'SUCCESS', code: 'USER_BLOCKED' })).toBe(false);
    expect(isBlockedAccountReply(false)).toBe(false);
  });
});

describe('lockFromReply', () => {
  it('turns a locked reply into a lock for that email and step', () => {
    expect(lockFromReply({ status: 'FAIL', lockedForSeconds: 900, lockedStep: 'otp' }, ' A@B.com ', NOW)).toEqual({
      step: 'otp',
      untilMs: NOW + 900_000,
      email: 'a@b.com',
    });
  });

  it('treats an unnamed step as the password step', () => {
    expect(lockFromReply({ status: 'FAIL', lockedForSeconds: 60 }, 'a@b.com', NOW)?.step).toBe('password');
  });

  it('ignores replies with no lock', () => {
    expect(lockFromReply({ status: 'FAIL', attemptsLeft: 3 }, 'a@b.com', NOW)).toBeNull();
    expect(lockFromReply({ status: 'FAIL', lockedForSeconds: 0 }, 'a@b.com', NOW)).toBeNull();
    expect(lockFromReply({ status: 'SUCCESS', lockedForSeconds: 60 }, 'a@b.com', NOW)).toBeNull();
    expect(lockFromReply(undefined, 'a@b.com', NOW)).toBeNull();
  });
});

describe('lockRemainingMs', () => {
  const lock = { step: 'password' as const, untilMs: NOW + 5000, email: 'a@b.com' };

  it('counts down for the locked email, whatever its capitals', () => {
    expect(lockRemainingMs(lock, 'A@B.com', NOW + 1000)).toBe(4000);
  });

  it('is zero for another email, after the lock ends, or with no lock', () => {
    expect(lockRemainingMs(lock, 'other@b.com', NOW)).toBe(0);
    expect(lockRemainingMs(lock, 'a@b.com', NOW + 5000)).toBe(0);
    expect(lockRemainingMs(null, 'a@b.com', NOW)).toBe(0);
  });
});

describe('countdown text', () => {
  it('shows minutes and seconds, rounding up so 0:00 never shows while locked', () => {
    expect(formatCountdown(900_000)).toBe('15:00');
    expect(formatCountdown(65_000)).toBe('1:05');
    expect(formatCountdown(8_001)).toBe('0:09');
    expect(formatCountdown(1)).toBe('0:01');
    expect(formatCountdown(-5)).toBe('0:00');
  });

  it('names the step that is locked', () => {
    expect(lockCountdownText('password', 900_000)).toBe('Too many failed sign-in attempts. Please try again in 15:00.');
    expect(lockCountdownText('otp', 61_000)).toBe('Too many incorrect codes. Please try again in 1:01.');
  });
});

describe('lockAfterStatusCheck', () => {
  const lock = { step: 'password' as const, untilMs: NOW + 600_000, email: 'ann@x.com' };

  it('drops the lock once the server says it is gone (e.g. an admin unlocked it)', () => {
    expect(lockAfterStatusCheck(lock, { status: 'SUCCESS', locked: false }, NOW)).toBeNull();
  });

  it('follows the server while the lock is still on', () => {
    expect(lockAfterStatusCheck(lock, { status: 'SUCCESS', locked: true, lockedStep: 'otp', lockedForSeconds: 30 }, NOW)).toEqual({
      step: 'otp',
      untilMs: NOW + 30_000,
      email: 'ann@x.com',
    });
  });

  it.each([
    ['a failed request', false],
    ['a FAIL reply', { status: 'FAIL', error: 'x' }],
    ['a locked reply with no time', { status: 'SUCCESS', locked: true }],
    ['a reply with no locked flag', { status: 'SUCCESS' }],
  ])('keeps the current lock on %s', (_label, response) => {
    expect(lockAfterStatusCheck(lock, response, NOW)).toBe(lock);
  });

  it('blockReasonFromReply returns the trimmed reason only for a blocked reply that has one', () => {
    const blocked = { status: 'FAIL', code: 'USER_BLOCKED' };
    expect(blockReasonFromReply({ ...blocked, blockReason: '  Repeated no-shows  ' })).toBe('Repeated no-shows');
    expect(blockReasonFromReply({ ...blocked })).toBeNull();
    expect(blockReasonFromReply({ ...blocked, blockReason: '   ' })).toBeNull();
    expect(blockReasonFromReply({ ...blocked, blockReason: 42 })).toBeNull();
    expect(blockReasonFromReply({ status: 'FAIL', attemptsLeft: 4, blockReason: 'x' })).toBeNull();
    expect(blockReasonFromReply(false)).toBeNull();
  });

  it('splitContactAdminText cuts the blocked message around its contact sentence', () => {
    expect(splitContactAdminText('Your profile is blocked. Contact admin for more details.')).toEqual({
      before: 'Your profile is blocked. ',
      link: 'Contact admin for more details.',
      after: '',
    });
    expect(splitContactAdminText('Blocked. Contact admin for more details. Thanks')?.after).toBe(' Thanks');
    expect(splitContactAdminText('Incorrect email or password.')).toBeNull();
  });
});
