import { endMeeting } from "../api/chatApi";
import type { Message } from "../actions/types";

export const ACTIVE_MEETING_KEY = "wl_active_meeting_thread_id";

export function setActiveMeetingThreadId(meetingThreadId: string): void {
    const id = String(meetingThreadId || "").trim();
    if (!id || typeof sessionStorage === "undefined") return;
    try {
        sessionStorage.setItem(ACTIVE_MEETING_KEY, id);
    } catch {
        /* ignore quota / private mode */
    }
}

export function getActiveMeetingThreadId(): string | null {
    if (typeof sessionStorage === "undefined") return null;
    try {
        const id = sessionStorage.getItem(ACTIVE_MEETING_KEY);
        return id && id.trim() ? id.trim() : null;
    } catch {
        return null;
    }
}

/** Remember active meeting when user opens Jitsi (start or re-join). */
export function trackMeetingJoin(meetingThreadId?: string | null, jitsiUrl?: string | null): void {
    if (jitsiUrl && meetingThreadId) {
        setActiveMeetingThreadId(String(meetingThreadId));
    }
}

export function clearActiveMeetingThreadId(): void {
    if (typeof sessionStorage === "undefined") return;
    try {
        sessionStorage.removeItem(ACTIVE_MEETING_KEY);
    } catch {
        /* ignore */
    }
}

/** End the meeting the user left open in Jitsi (best-effort). */
export async function tryEndActiveMeeting(
    onEnded?: (endMessage: Message | null) => void,
): Promise<void> {
    const id = getActiveMeetingThreadId();
    if (!id) return;
    clearActiveMeetingThreadId();
    try {
        const res = await endMeeting(id);
        const endMessage = (res?.endMessage ?? null) as Message | null;
        onEnded?.(endMessage);
    } catch (err) {
        console.warn("[meetingSession] could not end active meeting", err);
        onEnded?.(null);
    }
}
