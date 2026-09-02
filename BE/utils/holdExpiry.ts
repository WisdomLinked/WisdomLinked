
export const HOLD_SAFETY_MARGIN_MS = 12 * 60 * 60 * 1000;

export const HOLD_FALLBACK_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

export const captureBeforeMs = (intent: any): number => {
    const charge = intent?.latest_charge && typeof intent.latest_charge === 'object'
        ? intent.latest_charge
        : null;
    const seconds = charge?.payment_method_details?.card?.capture_before;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return 0;
    return Math.round(seconds * 1000);
};

export const decisionDeadlineFrom = ({
    captureBefore,
    sessionStartMs,
    now = Date.now(),
    marginMs = HOLD_SAFETY_MARGIN_MS,
}: {
    captureBefore: number;
    sessionStartMs?: number;
    now?: number;
    marginMs?: number;
}): Date => {
    const ceiling = captureBefore > 0 ? captureBefore : now + HOLD_FALLBACK_WINDOW_MS;
    let deadline = ceiling - marginMs;

    if (typeof sessionStartMs === 'number' && sessionStartMs > 0 && sessionStartMs < deadline) {
        deadline = sessionStartMs;
    }

    return new Date(Math.max(deadline, now));
};

export const holdHasLapsed = (deadline: any, now = Date.now()): boolean => {
    if (!deadline) return false;
    const ms = deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime();
    if (!Number.isFinite(ms)) return false;
    return ms <= now;
};
