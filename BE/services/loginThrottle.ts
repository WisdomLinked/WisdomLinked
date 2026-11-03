const LoginAttempt = require('../models/LoginAttempt');
const {
    LOGIN_LOCK_MS,
    MAX_LOGIN_ATTEMPTS,
    countedFailures,
    lockRemainingMs,
} = require('../utils/loginAttempts');

type Kind = 'password' | 'otp';

const limitsDisabled = () => process.env.LOGIN_ATTEMPT_LIMITS_DISABLED === 'true';

const emailKey = (email: unknown): string => String(email ?? '').trim().toLowerCase();

const isDuplicateKey = (err: any) => err?.code === 11000;

/** Milliseconds this step stays locked for this email; 0 when it is open. */
const loginLockRemainingMs = async (email: unknown, kind: Kind, now: Date = new Date()): Promise<number> => {
    const key = emailKey(email);
    if (limitsDisabled() || !key) return 0;
    const record = await LoginAttempt.findOne({ email: key }).lean();
    return lockRemainingMs(record?.[kind], now.getTime());
};

/**
 * Takes the next numbered try *before* the password or code is checked, so simultaneous requests
 * each get a different number and only tries 1–5 are ever checked. `attemptNo` is null when the
 * limits are off.
 */
const claimLoginAttempt = async (
    email: unknown,
    kind: Kind,
    now: Date = new Date()
): Promise<{ allowed: boolean; attemptNo: number | null; lockedForMs: number }> => {
    const key = emailKey(email);
    if (limitsDisabled() || !key) return { allowed: true, attemptNo: null, lockedForMs: 0 };
    const nowMs = now.getTime();

    const existing = await LoginAttempt.findOne({ email: key }).lean();
    const lockedMs = lockRemainingMs(existing?.[kind], nowMs);
    if (lockedMs > 0) return { allowed: false, attemptNo: null, lockedForMs: lockedMs };
    if (existing && countedFailures(existing[kind], nowMs) === 0 && Number(existing[kind]?.failures) > 0) {
        await LoginAttempt.updateOne(
            { email: key, [`${kind}.lastFailedAt`]: existing[kind]?.lastFailedAt ?? null },
            { $set: { [`${kind}.failures`]: 0, [`${kind}.lockUntil`]: null } }
        );
    }

    const bump = () =>
        LoginAttempt.findOneAndUpdate(
            { email: key },
            { $inc: { [`${kind}.failures`]: 1 }, $set: { [`${kind}.lastFailedAt`]: now } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
    let updated: any;
    try {
        updated = await bump();
    } catch (err) {
        if (!isDuplicateKey(err)) throw err;
        updated = await bump();
    }

    const attemptNo = Number(updated?.[kind]?.failures) || 0;
    if (attemptNo <= MAX_LOGIN_ATTEMPTS) return { allowed: true, attemptNo, lockedForMs: 0 };
    const alreadyLocked = lockRemainingMs(updated?.[kind], nowMs);
    return { allowed: false, attemptNo, lockedForMs: alreadyLocked || (await lockLoginStep(key, kind, now)) };
};

/** Starts the 15-minute lock for this step; returns its length. */
const lockLoginStep = async (email: unknown, kind: Kind, now: Date = new Date()): Promise<number> => {
    await LoginAttempt.updateOne(
        { email: emailKey(email) },
        { $set: { [`${kind}.lockUntil`]: new Date(now.getTime() + LOGIN_LOCK_MS) } }
    );
    return LOGIN_LOCK_MS;
};

/** Forgets wrong tries for the given steps (both by default) — after a successful sign-in or a password reset. */
const clearLoginFailures = async (email: unknown, kinds: Kind[] = ['password', 'otp']): Promise<void> => {
    const key = emailKey(email);
    if (!key || !kinds.length) return;
    const reset: Record<string, unknown> = {};
    for (const kind of kinds) {
        reset[`${kind}.failures`] = 0;
        reset[`${kind}.lockUntil`] = null;
        reset[`${kind}.lastFailedAt`] = null;
    }
    await LoginAttempt.updateOne({ email: key }, { $set: reset });
};

module.exports = {
    claimLoginAttempt,
    clearLoginFailures,
    lockLoginStep,
    loginLockRemainingMs,
};
