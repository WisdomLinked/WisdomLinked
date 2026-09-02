import { describe, expect, it, vi, beforeEach } from "vitest";
import * as chatApi from "../api/chatApi";
import {
    ACTIVE_MEETING_KEY,
    PENDING_END_MEETING_KEY,
    handleMeetPostMessage,
    setPendingEndMeetingId,
    tryEndPendingMeeting,
} from "./meetingSession";

describe("meetingSession", () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it("handleMeetPostMessage stores pending end from meet origin", () => {
        handleMeetPostMessage({
            origin: "https://meet.wisdomlinked.com",
            data: { type: "wl-meeting-alone", meetingThreadId: "m-1" },
        } as MessageEvent);

        expect(sessionStorage.getItem(PENDING_END_MEETING_KEY)).toBe("m-1");
    });

    it("tryEndPendingMeeting calls endMeeting with last_participant_return", async () => {
        setPendingEndMeetingId("meeting-abc");
        const endSpy = vi.spyOn(chatApi, "endMeeting").mockResolvedValue({ endMessage: null });

        await tryEndPendingMeeting();

        expect(endSpy).toHaveBeenCalledWith("meeting-abc", "last_participant_return");
        expect(sessionStorage.getItem(PENDING_END_MEETING_KEY)).toBeNull();
        expect(sessionStorage.getItem(ACTIVE_MEETING_KEY)).toBeNull();
    });
});
