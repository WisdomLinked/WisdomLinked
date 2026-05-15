import { useEffect, useRef } from "react";
import { tryEndActiveMeeting } from "../utils/meetingSession";

/** When the user returns from Jitsi to chat/dashboard, end the stored active meeting once. */
export function useEndMeetingOnReturn(): void {
    const ran = useRef(false);
    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        void tryEndActiveMeeting();
    }, []);
}
