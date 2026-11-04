export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
/** Wrong tries this old no longer count, so a forgotten typo from last week cannot lock anyone. */
export const LOGIN_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type LoginAttemptKind = "password" | "otp";

export type LoginAttemptState = {
    failures?: number | null;
    lockUntil?: Date | string | null;
    lastFailedAt?: Date | string | null;
};

const toMs = (value: Date | string | null | undefined): number | null => {
    if (value === null || value === undefined || value === "") return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
};

/** Milliseconds left on a lock, or 0 when there is none (or it has run out). */
export const lockRemainingMs = (state: LoginAttemptState | null | undefined, nowMs: number): number => {
    const until = toMs(state?.lockUntil);
    return until !== null && until > nowMs ? until - nowMs : 0;
};

/**
 * Wrong tries that still count right now. A lock that has run out, or a last wrong try older than
 * the window, means the user is back to a full set of attempts.
 */
export const countedFailures = (state: LoginAttemptState | null | undefined, nowMs: number): number => {
    if (!state) return 0;
    const until = toMs(state.lockUntil);
    if (until !== null && until <= nowMs) return 0;
    const last = toMs(state.lastFailedAt);
    if (last === null || nowMs - last > LOGIN_ATTEMPT_WINDOW_MS) return 0;
    const failures = Number(state.failures);
    return Number.isFinite(failures) && failures > 0 ? Math.floor(failures) : 0;
};

export type ActiveLoginLock = { step: LoginAttemptKind; lockedUntil: Date };

/** The lock still running on an account's record, or null. When both steps are locked, the one that ends last. */
export const activeLoginLock = (
    record: { password?: LoginAttemptState | null; otp?: LoginAttemptState | null } | null | undefined,
    nowMs: number
): ActiveLoginLock | null => {
    let best: ActiveLoginLock | null = null;
    for (const step of ["password", "otp"] as const) {
        const remaining = lockRemainingMs(record?.[step], nowMs);
        if (remaining > 0 && (!best || nowMs + remaining > best.lockedUntil.getTime())) {
            best = { step, lockedUntil: new Date(nowMs + remaining) };
        }
    }
    return best;
};

export const attemptsLeft = (failures: number): number =>
    Math.max(0, MAX_LOGIN_ATTEMPTS - Math.max(0, Math.floor(Number(failures) || 0)));

/** Whether this many wrong tries locks the step (the 5th, and anything a concurrent request adds). */
export const shouldLock = (failures: number): boolean => attemptsLeft(failures) === 0;

/** Whole minutes, rounded up, so "0 minutes" is never shown while still locked. */
export const minutesUntil = (remainingMs: number): number => Math.max(1, Math.ceil(remainingMs / 60000));

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const attemptsLeftSentence = (left: number): string =>
    `You have ${plural(left, "attempt", "attempts")} left.`;

export const lockedMessage = (kind: LoginAttemptKind, remainingMs: number): string => {
    const wait = plural(minutesUntil(remainingMs), "minute", "minutes");
    return kind === "password"
        ? `Too many failed sign-in attempts. Please try again in ${wait}.`
        : `Too many incorrect codes. Please try again in ${wait}.`;
};
