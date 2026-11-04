export type UserStatus = 'active' | 'review' | 'blocked';

export const USER_STATUS_OPTIONS: ReadonlyArray<{
  value: UserStatus;
  label: string;
  className: string;
  menuClassName?: string;
}> = [
  { value: 'active', label: 'Active', className: 'font-medium text-wl-brand', menuClassName: 'font-medium text-green' },
  { value: 'review', label: 'In review', className: 'text-brownyellow' },
  { value: 'blocked', label: 'Blocked', className: 'text-red' },
];

export function userStatusOption(status?: string) {
  return USER_STATUS_OPTIONS.find(o => o.value === status) ?? USER_STATUS_OPTIONS[1];
}

/** The sign-in lock the server attached to a user row (5 wrong passwords or codes). */
export type UserLoginLock = { step?: 'password' | 'otp'; lockedUntil?: string | Date | null } | null | undefined;

/** True while the lock has not run out yet. */
export function isLoginLocked(lock: UserLoginLock, nowMs: number = Date.now()): boolean {
  const until = lock?.lockedUntil ? new Date(lock.lockedUntil).getTime() : NaN;
  return Number.isFinite(until) && until > nowMs;
}
