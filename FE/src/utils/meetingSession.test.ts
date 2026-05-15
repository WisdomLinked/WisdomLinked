import { describe, expect, it, vi, beforeEach } from "vitest";
import * as chatApi from "../api/chatApi";
import {
    ACTIVE_MEETING_KEY,
    ALONE_IN_ROOM_KEY,
    clearActiveMeetingOnReturn,
    getActiveMeetingThreadId,
    setActiveMeetingThreadId,
} from "./meetingSession";

describe("meetingSession", () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it("clearActiveMeetingOnReturn removes stored id without calling endMeeting when not alone", async () => {
        setActiveMeetingThreadId("meeting-abc");
        const endSpy = vi.spyOn(chatApi, "endMeeting").mockResolvedValue(null);

        await clearActiveMeetingOnReturn();

        expect(getActiveMeetingThreadId()).toBeNull();
        expect(sessionStorage.getItem(ACTIVE_MEETING_KEY)).toBeNull();
        expect(endSpy).not.toHaveBeenCalled();
    });

    it("clearActiveMeetingOnReturn ends meeting when wlAloneInRoom was set", async () => {
        setActiveMeetingThreadId("meeting-abc");
        sessionStorage.setItem(ALONE_IN_ROOM_KEY, "1");
        const endSpy = vi.spyOn(chatApi, "endMeeting").mockResolvedValue({ endMessage: null });

        await clearActiveMeetingOnReturn();

        expect(endSpy).toHaveBeenCalledWith("meeting-abc", "last_participant_return");
        expect(sessionStorage.getItem(ALONE_IN_ROOM_KEY)).toBeNull();
        expect(getActiveMeetingThreadId()).toBeNull();
    });
});
