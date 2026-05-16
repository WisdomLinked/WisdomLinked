import { useEffect, useMemo, useState } from "react";
import { getMeetingThread } from "../api/chatApi";
import { buildMeetingThreadMaps, type EndedMeetingInfo } from "../utils/meetingThreadMaps";

/**
 * For started meetings without __MEETING_ENDED__ in chat, sync status from Mongo
 * so UI does not stay "in progress" when end-call succeeded but RC message is missing.
 */
export function useMeetingStatusReconcile(
    displayMessages: Array<{ content?: string }>,
): Map<string, EndedMeetingInfo> {
    const { endedMeetings, startedMeetings } = useMemo(
        () => buildMeetingThreadMaps(displayMessages),
        [displayMessages],
    );
    const [dbEnded, setDbEnded] = useState<Map<string, EndedMeetingInfo>>(new Map());

    const inProgressIds = useMemo(() => {
        const ids: string[] = [];
        startedMeetings.forEach((_, id) => {
            if (!endedMeetings.has(id) && !dbEnded.has(id)) ids.push(id);
        });
        return ids.join(",");
    }, [startedMeetings, endedMeetings, dbEnded]);

    useEffect(() => {
        const ids = inProgressIds ? inProgressIds.split(",").filter(Boolean) : [];
        if (!ids.length) return;
        let cancelled = false;
        void (async () => {
            const updates = new Map<string, EndedMeetingInfo>();
            for (const id of ids) {
                const res = await getMeetingThread(id);
                const meeting = res?.meeting;
                if (meeting?.status === "ended") {
                    const participants = Array.isArray(meeting.participants)
                        ? meeting.participants.length
                        : 0;
                    updates.set(id, {
                        duration: Number(meeting.duration) || 0,
                        participantCount: participants,
                    });
                }
            }
            if (!cancelled && updates.size > 0) {
                setDbEnded((prev) => {
                    const next = new Map(prev);
                    updates.forEach((v, k) => next.set(k, v));
                    return next;
                });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [inProgressIds]);

    return dbEnded;
}
