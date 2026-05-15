import { describe, expect, it, vi, beforeEach } from "vitest";
import {
    ACTIVE_MEETING_KEY,
    clearActiveMeetingOnReturn,
    getActiveMeetingThreadId,
    setActiveMeetingThreadId,
} from "./meetingSession";

describe("meetingSession", () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it("clearActiveMeetingOnReturn removes stored id without calling endMeeting API", async () => {
        setActiveMeetingThreadId("meeting-abc");
        const fetchSpy = vi.spyOn(globalThis, "fetch");

        clearActiveMeetingOnReturn();

        expect(getActiveMeetingThreadId()).toBeNull();
        expect(sessionStorage.getItem(ACTIVE_MEETING_KEY)).toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
