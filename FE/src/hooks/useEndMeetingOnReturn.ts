import { useEffect, useRef } from "react";
import { clearActiveMeetingOnReturn } from "../utils/meetingSession";

/** When the user returns from Jitsi to chat/dashboard, drop local active-meeting tracking only. */
export function useEndMeetingOnReturn(): void {
    const ran = useRef(false);
    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        clearActiveMeetingOnReturn();
    }, []);
}
