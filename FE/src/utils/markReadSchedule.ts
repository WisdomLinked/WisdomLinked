export const MARK_READ_DEBOUNCE_MS = 1200;

export const MARK_READ_MIN_GAP_MS = 8000;

/**
 * How long to wait before reporting the read.
 *
 * @param sinceLastMarkMs time since the last successful report; pass `Infinity` (or any value
 *   at or beyond the gap) when none has happened yet.
 */
export function markReadDelayMs(
    sinceLastMarkMs: number,
    debounceMs: number = MARK_READ_DEBOUNCE_MS,
    minGapMs: number = MARK_READ_MIN_GAP_MS,
): number {
    const since = Number.isFinite(sinceLastMarkMs) ? Number(sinceLastMarkMs) : minGapMs;
    // A negative elapsed time means the clock moved backwards; treat it as "just marked".
    const remainingGap = since < 0 ? minGapMs : minGapMs - since;
    return Math.max(debounceMs, remainingGap);
}
