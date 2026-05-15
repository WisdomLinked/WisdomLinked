import { endMeeting } from "../api/chatApi";
import type { Message } from "../actions/types";

export const ACTIVE_MEETING_KEY = "wl_active_meeting_thread_id";
export const ALONE_IN_ROOM_KEY = "wlAloneInRoom";

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

export function wasAloneInRoomBeforeReturn(): boolean {
    if (typeof sessionStorage === "undefined") return false;
    try {
        return sessionStorage.getItem(ALONE_IN_ROOM_KEY) === "1";
    } catch {
        return false;
    }
}

export function clearAloneInRoomFlag(): void {
    if (typeof sessionStorage === "undefined") return;
    try {
        sessionStorage.removeItem(ALONE_IN_ROOM_KEY);
    } catch {
        /* ignore */
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

/**
 * On return from Jitsi: end meeting if user was alone (wlAloneInRoom set by meet hangup script),
 * otherwise only clear local tracking.
 */
export async function clearActiveMeetingOnReturn(
    onEnded?: (endMessage: Message | null) => void,
): Promise<void> {
    const id = getActiveMeetingThreadId();
    const alone = wasAloneInRoomBeforeReturn();
    clearActiveMeetingThreadId();
    clearAloneInRoomFlag();
    if (!id || !alone) {
        onEnded?.(null);
        return;
    }
    try {
        const res = await endMeeting(id, "last_participant_return");
        const endMessage = (res?.endMessage ?? null) as Message | null;
        onEnded?.(endMessage);
    } catch (err) {
        console.warn("[meetingSession] could not end meeting on return", err);
        onEnded?.(null);
    }
}
