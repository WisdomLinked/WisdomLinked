const buckets = new Map<string, number[]>();

/**
 * Fixed-window style limiter: max `maxHits` timestamps kept within `windowMs`.
 * Returns false when the caller should be rejected (429).
 */
export function allowMeetingChatRate(key: string, maxHits: number, windowMs: number): boolean {
    const now = Date.now();
    const prev = buckets.get(key) || [];
    const fresh = prev.filter((t) => now - t < windowMs);
    if (fresh.length >= maxHits) {
        buckets.set(key, fresh);
        return false;
    }
    fresh.push(now);
    buckets.set(key, fresh);
    return true;
}
