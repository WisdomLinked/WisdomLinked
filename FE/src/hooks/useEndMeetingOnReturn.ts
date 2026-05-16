import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { addNewMessage } from "../actions/chatActions";
import {
    handleMeetPostMessage,
    startMeetPopupCloseWatcher,
    tryEndPendingMeeting,
} from "../utils/meetingSession";

/** End meeting when meet tab signals alone/ended or meet popup closes after alone. */
export function useEndMeetingOnReturn(): void {
    const dispatch = useDispatch();
    const ran = useRef(false);
    useEffect(() => {
        if (ran.current) return;
        ran.current = true;

        const onEnded = (endMessage: Parameters<typeof addNewMessage>[0] | null) => {
            if (endMessage) dispatch(addNewMessage(endMessage));
        };

        const onMessage = (event: MessageEvent) => {
            handleMeetPostMessage(event, onEnded);
        };
        window.addEventListener("message", onMessage);
        const stopWatch = startMeetPopupCloseWatcher(onEnded);

        void tryEndPendingMeeting(onEnded);

        return () => {
            window.removeEventListener("message", onMessage);
            stopWatch();
        };
    }, [dispatch]);
}
