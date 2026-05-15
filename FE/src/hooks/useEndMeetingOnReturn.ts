import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { addNewMessage } from "../actions/chatActions";
import { clearActiveMeetingOnReturn } from "../utils/meetingSession";

/** When the user returns from Jitsi, end the meeting if they were alone; otherwise clear tracking only. */
export function useEndMeetingOnReturn(): void {
    const dispatch = useDispatch();
    const ran = useRef(false);
    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        void clearActiveMeetingOnReturn((endMessage) => {
            if (endMessage) dispatch(addNewMessage(endMessage));
        });
    }, [dispatch]);
}
