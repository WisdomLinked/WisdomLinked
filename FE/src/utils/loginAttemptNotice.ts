export type LoginStep = 'password' | 'otp';

export type LoginLock = {
  step: LoginStep;
  untilMs: number;
  /** Lower-cased email the lock belongs to; typing another email is a different account. */
  email: string;
};

const normalizeEmail = (email: unknown) => String(email ?? '').trim().toLowerCase();

/** True when the reply is about the attempt limits (so it belongs under the field, not in the banner). */
export const isAttemptLimitReply = (response: any): boolean =>
  response?.status === 'FAIL' && typeof response?.attemptsLeft === 'number';

/** True when sign-in was refused because the account is blocked (shown under the field, like a wrong try). */
export const isBlockedAccountReply = (response: any): boolean =>
  response?.status === 'FAIL' && response?.code === 'USER_BLOCKED';

export const lockFromReply = (response: any, email: unknown, nowMs: number): LoginLock | null => {
  const seconds = Number(response?.lockedForSeconds);
  if (response?.status !== 'FAIL' || !Number.isFinite(seconds) || seconds <= 0) return null;
  const step: LoginStep = response?.lockedStep === 'otp' ? 'otp' : 'password';
  return { step, untilMs: nowMs + seconds * 1000, email: normalizeEmail(email) };
};

export const lockRemainingMs = (lock: LoginLock | null, email: unknown, nowMs: number): number => {
  if (!lock || lock.email !== normalizeEmail(email)) return 0;
  return Math.max(0, lock.untilMs - nowMs);
};

/** 14:05, or 0:09 — whole seconds, rounded up so it never shows 0:00 while still locked. */
export const formatCountdown = (remainingMs: number): string => {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const lockCountdownText = (step: LoginStep, remainingMs: number): string => {
  const lead = step === 'otp' ? 'Too many incorrect codes.' : 'Too many failed sign-in attempts.';
  return `${lead} Please try again in ${formatCountdown(remainingMs)}.`;
};

/** How often the login page asks whether a running lock is still on (an admin may have unlocked it). */
export const LOCK_STATUS_POLL_MS = 10_000;

/**
 * The lock to keep after a lock-status answer: null once the server says it is gone, the server's
 * remaining time while it is still on, or the current lock unchanged when the answer is unusable.
 */
export const lockAfterStatusCheck = (lock: LoginLock, response: any, nowMs: number): LoginLock | null => {
  if (response?.status !== 'SUCCESS') return lock;
  if (response.locked === false) return null;
  const seconds = Number(response.lockedForSeconds);
  if (response.locked !== true || !Number.isFinite(seconds) || seconds <= 0) return lock;
  const step: LoginStep = response.lockedStep === 'otp' ? 'otp' : 'password';
  return { step, untilMs: nowMs + seconds * 1000, email: lock.email };
};
