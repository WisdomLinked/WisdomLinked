import { describe, expect, it, vi } from "vitest";
import { addNewMessage } from "../../../../actions/chatActions";
import { appendMeetingStartMessage } from "./Header";

describe("appendMeetingStartMessage", () => {
    it("dispatches addNewMessage when startMeeting returns a message", () => {
        const dispatch = vi.fn();
        const message = {
            _id: "temp-1",
            content: "__MEETING_STARTED__::mid::room::Alice",
            type: "meeting",
        };

        appendMeetingStartMessage({ message, jitsiUrl: "https://meet.example/room" }, dispatch);

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith(addNewMessage(message as any));
    });

    it("does not dispatch when startMeeting response has no message payload", () => {
        const dispatch = vi.fn();

        appendMeetingStartMessage({ jitsiUrl: "https://meet.example/room" }, dispatch);

        expect(dispatch).not.toHaveBeenCalled();
    });
});
