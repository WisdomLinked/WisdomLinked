import { describe, it, expect } from "vitest";
import {
    MARK_READ_DEBOUNCE_MS,
    MARK_READ_MIN_GAP_MS,
    markReadDelayMs,
} from "./markReadSchedule";

describe("markReadDelayMs", () => {
    it("uses the plain debounce when nothing has been reported recently", () => {
        expect(markReadDelayMs(MARK_READ_MIN_GAP_MS)).toBe(MARK_READ_DEBOUNCE_MS);
        expect(markReadDelayMs(60_000)).toBe(MARK_READ_DEBOUNCE_MS);
    });

    it("uses the debounce on the very first read of a session", () => {
        // lastMarkReadAtRef starts at 0, so the elapsed time is epoch-sized.
        expect(markReadDelayMs(Date.now())).toBe(MARK_READ_DEBOUNCE_MS);
        expect(markReadDelayMs(Infinity)).toBe(MARK_READ_DEBOUNCE_MS);
    });

    it("waits out the remainder of the window instead of dropping the read", () => {
        expect(markReadDelayMs(2000)).toBe(6000);
        expect(markReadDelayMs(5000)).toBe(3000);
        expect(markReadDelayMs(0)).toBe(MARK_READ_MIN_GAP_MS);
    });

    it("never returns zero, so a read is always actually scheduled", () => {
        for (const since of [0, 1, 1000, 7999, 8000, 8001, 100000]) {
            expect(markReadDelayMs(since)).toBeGreaterThanOrEqual(MARK_READ_DEBOUNCE_MS);
        }
    });

    it("never schedules sooner than the debounce, even at the edge of the window", () => {
        // 7000ms elapsed leaves 1000ms of window, which is below the debounce floor.
        expect(markReadDelayMs(7000)).toBe(MARK_READ_DEBOUNCE_MS);
        expect(markReadDelayMs(6800)).toBe(MARK_READ_DEBOUNCE_MS);
        expect(markReadDelayMs(6700)).toBe(1300);
    });

    it("respects the rate limit: the gap since the last report is never undercut", () => {
        for (const since of [0, 500, 2000, 4000, 6000]) {
            expect(since + markReadDelayMs(since)).toBeGreaterThanOrEqual(MARK_READ_MIN_GAP_MS);
        }
    });

    it("treats a backwards clock as if a report just happened", () => {
        expect(markReadDelayMs(-5000)).toBe(MARK_READ_MIN_GAP_MS);
    });

    it("treats a nonsense elapsed time as safe to report now", () => {
        expect(markReadDelayMs(Number.NaN)).toBe(MARK_READ_DEBOUNCE_MS);
    });

    it("honours overridden timings for callers that want different ones", () => {
        expect(markReadDelayMs(1000, 100, 5000)).toBe(4000);
        expect(markReadDelayMs(4950, 100, 5000)).toBe(100);
    });
});
