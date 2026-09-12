import { endMeeting } from "../api/chatApi";
import type { Message } from "../actions/types";

export const ACTIVE_MEETING_KEY = "wl_active_meeting_thread_id";
export const PENDING_END_MEETING_KEY = "wlPendingEndMeeting";

let meetPopup: Window | null = null;

const endInFlight = new Set<string>();

const isWisdomLinkedOrigin = (origin: string): boolean =>
    /^https:\/\/([a-z0-9-]+\.)?wisdomlinked\.com$/i.test(String(origin || ""));

export function registerMeetPopup(win: Window | null | undefined): void {
    if (win && !win.closed) meetPopup = win;
}

export function setActiveMeetingThreadId(meetingThreadId: string): void {
    const id = String(meetingThreadId || "").trim();
    if (!id || typeof sessionStorage === "undefined") return;
    try {
        sessionStorage.setItem(ACTIVE_MEETING_KEY, id);
    } catch {
        /* ignore */
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

export function setPendingEndMeetingId(meetingThreadId: string): void {
    const id = String(meetingThreadId || "").trim();
    if (!id || typeof sessionStorage === "undefined") return;
    try {
        sessionStorage.setItem(PENDING_END_MEETING_KEY, id);
        sessionStorage.setItem(ACTIVE_MEETING_KEY, id);
    } catch {
        /* ignore */
    }
}

function clearMeetingSessionKeys(): void {
    if (typeof sessionStorage === "undefined") return;
    try {
        sessionStorage.removeItem(ACTIVE_MEETING_KEY);
        sessionStorage.removeItem(PENDING_END_MEETING_KEY);
    } catch {
        /* ignore */
    }
}

/** Remember active meeting when user opens Jitsi (start or re-join). */
export function trackMeetingJoin(
    meetingThreadId?: string | null,
    jitsiUrl?: string | null,
    popup?: Window | null,
): void {
    registerMeetPopup(popup);
    if (meetingThreadId) {
        setActiveMeetingThreadId(String(meetingThreadId));
    }
}

export async function tryEndPendingMeeting(
    onEnded?: (endMessage: Message | null) => void,
    meetingThreadId?: string | null,
): Promise<boolean> {
    const pending =
        (meetingThreadId && String(meetingThreadId).trim()) ||
        (typeof sessionStorage !== "undefined"
            ? sessionStorage.getItem(PENDING_END_MEETING_KEY)
            : null);
    const id = pending && String(pending).trim() ? String(pending).trim() : "";
    if (!id) return false;
    clearMeetingSessionKeys();
    try {
        const res = await endMeeting(id, "last_participant_return");
        const endMessage = (res?.endMessage ?? null) as Message | null;
        onEnded?.(endMessage);
        return true;
    } catch (err) {
        console.warn("[meetingSession] could not end meeting", err);
        onEnded?.(null);
        return false;
    }
}

/** Handle postMessage from meet.wisdomlinked.com (cross-origin alone / ended signals). */
export function handleMeetPostMessage(
    event: MessageEvent,
    onEnded?: (endMessage: Message | null) => void,
): void {
    if (!isWisdomLinkedOrigin(event.origin)) return;
    const data = event.data as { type?: string; meetingThreadId?: string } | null;
    if (!data?.type || !data.meetingThreadId) return;
    if (data.type === "wl-meeting-alone") {
        setPendingEndMeetingId(data.meetingThreadId);
        return;
    }
    if (data.type === "wl-meeting-ended") {
        setPendingEndMeetingId(data.meetingThreadId);
        void tryEndPendingMeeting(onEnded);
    }
}

export function startMeetPopupCloseWatcher(
    onEnded?: (endMessage: Message | null) => void,
): () => void {
    const interval = window.setInterval(() => {
        if (!meetPopup || !meetPopup.closed) return;
        meetPopup = null;

        const pending =
            (typeof sessionStorage !== "undefined" &&
                sessionStorage.getItem(PENDING_END_MEETING_KEY)) ||
            getActiveMeetingThreadId();
        if (!pending) return;

        if (endInFlight.has(pending)) return;
        endInFlight.add(pending);
        void tryEndPendingMeeting(onEnded, pending).finally(() => endInFlight.delete(pending));
    }, 800);
    return () => window.clearInterval(interval);
}
