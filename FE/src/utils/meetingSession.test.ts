import { describe, expect, it, vi, beforeEach } from "vitest";
import * as chatApi from "../api/chatApi";
import {
    ACTIVE_MEETING_KEY,
    PENDING_END_MEETING_KEY,
    handleMeetPostMessage,
    setPendingEndMeetingId,
    setActiveMeetingThreadId,
    registerMeetPopup,
    startMeetPopupCloseWatcher,
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

    it("does not end a live meeting just because one is open", async () => {
        sessionStorage.setItem(ACTIVE_MEETING_KEY, "meeting-live");
        const endSpy = vi.spyOn(chatApi, "endMeeting").mockResolvedValue({ endMessage: null });

        const ended = await tryEndPendingMeeting();

        expect(ended).toBe(false);
        expect(endSpy).not.toHaveBeenCalled();
        expect(sessionStorage.getItem(ACTIVE_MEETING_KEY)).toBe("meeting-live");
    });

    it("still ends the meeting once the meet tab reports it is over", async () => {
        sessionStorage.setItem(ACTIVE_MEETING_KEY, "meeting-live");
        const endSpy = vi.spyOn(chatApi, "endMeeting").mockResolvedValue({ endMessage: null });

        handleMeetPostMessage({
            origin: "https://meet.wisdomlinked.com",
            data: { type: "wl-meeting-alone", meetingThreadId: "meeting-live" },
        } as MessageEvent);
        const ended = await tryEndPendingMeeting();

        expect(ended).toBe(true);
        expect(endSpy).toHaveBeenCalledWith("meeting-live", "last_participant_return");
    });

});

describe("ending a call when the meet window closes", () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    /** The window is registered while it is still open, exactly as opening a call does. */
    const openMeetWindow = () => {
        const win = { closed: false } as { closed: boolean } as Window & { closed: boolean };
        registerMeetPopup(win);
        return win;
    };

    it("ends the active meeting once the meet window is gone", async () => {
        const end = vi.spyOn(chatApi, "endMeeting").mockResolvedValue({ endMessage: null });
        setActiveMeetingThreadId("m-live");
        const win = openMeetWindow();

        const stop = startMeetPopupCloseWatcher();
        win.closed = true; // the user hangs up and Jitsi closes its tab
        await vi.waitFor(() => expect(end).toHaveBeenCalled(), { timeout: 4000 });
        stop();

        expect(end).toHaveBeenCalledWith("m-live", "last_participant_return");
    });

    it("does nothing while the meet window is still open", async () => {
        const end = vi.spyOn(chatApi, "endMeeting").mockResolvedValue({ endMessage: null });
        setActiveMeetingThreadId("m-live");
        const win = openMeetWindow();

        const stop = startMeetPopupCloseWatcher();
        await new Promise((r) => setTimeout(r, 1600));
        stop();
        win.closed = true; // tidy up so the shared reference does not leak

        expect(end).not.toHaveBeenCalled();
    });

    it("only ends once even though several screens run a watcher", async () => {
        const end = vi.spyOn(chatApi, "endMeeting").mockResolvedValue({ endMessage: null });
        setActiveMeetingThreadId("m-live");
        const win = openMeetWindow();

        const stops = [
            startMeetPopupCloseWatcher(),
            startMeetPopupCloseWatcher(),
            startMeetPopupCloseWatcher(),
        ];
        win.closed = true;
        await vi.waitFor(() => expect(end).toHaveBeenCalled(), { timeout: 4000 });
        await new Promise((r) => setTimeout(r, 1400));
        stops.forEach((s) => s());

        expect(end).toHaveBeenCalledTimes(1);
    });

    it("still does not end a live call just because a screen mounted", async () => {
        const end = vi.spyOn(chatApi, "endMeeting").mockResolvedValue({ endMessage: null });
        setActiveMeetingThreadId("m-live");
        // nothing observed the user leaving — this is the Tasks 3/4 regression case
        const ended = await tryEndPendingMeeting();
        expect(ended).toBe(false);
        expect(end).not.toHaveBeenCalled();
    });

    it("leaves nothing behind when there is no meeting to end", async () => {
        const end = vi.spyOn(chatApi, "endMeeting").mockResolvedValue({ endMessage: null });
        const win = openMeetWindow();
        const stop = startMeetPopupCloseWatcher();
        win.closed = true;
        await new Promise((r) => setTimeout(r, 1600));
        stop();
        expect(end).not.toHaveBeenCalled();
    });
});
