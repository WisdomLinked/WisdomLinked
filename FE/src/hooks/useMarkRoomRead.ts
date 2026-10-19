import { useCallback, useEffect, useRef } from 'react';
import { markReadDelayMs } from '../utils/markReadSchedule';

const owedReadSenders = new Set<() => Promise<void>>();

/**
 * Sends every read that is still waiting on its delay, and resolves once they have been answered
 * (or after `timeoutMs`). Logout calls this first: once the session is gone, a waiting read can no
 * longer be sent and the room would stay unread.
 */
export function flushOwedChatReads(timeoutMs = 2000): Promise<void> {
    const sends = Array.from(owedReadSenders).map(send => send());
    if (!sends.length) return Promise.resolve();
    return Promise.race([
        Promise.all(sends).then(() => undefined),
        new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
    ]);
}

/**
 * Reports a chat room as read once the user has seen an incoming message in it.
 *
 * The report is delayed (debounce + rate-limit window, see markReadSchedule) but never dropped:
 * once a read is owed for a room it is sent even if the user leaves or switches chats before the
 * delay runs out, and even if their own reply becomes the newest message in the meantime. The
 * unread badge is cleared on screen the moment a chat opens, so a dropped report would look read
 * until the next refresh brought the count back.
 *
 * @param roomId      Rocket.Chat room currently open, or null.
 * @param readOwed    true while the newest message on screen is from someone else.
 * @param activityKey changes whenever the visible messages change, restarting the debounce.
 * @param report      sends the read; resolves true when the server accepted it.
 * @param reportOnExit sends the read when the page is hidden or closed (must survive unload, e.g. a
 *                     keepalive request). Without it the normal report is used.
 */
export function useMarkRoomRead(
    roomId: string | null | undefined,
    readOwed: boolean,
    activityKey: unknown,
    report: (roomId: string) => Promise<boolean>,
    reportOnExit?: (roomId: string) => void,
): void {
    const pendingRoomRef = useRef<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastReportAtRef = useRef<number>(0);
    const reportRef = useRef(report);
    reportRef.current = report;
    const reportOnExitRef = useRef(reportOnExit);
    reportOnExitRef.current = reportOnExit;

    const flush = useCallback((rid: string): Promise<void> => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (pendingRoomRef.current !== rid) return Promise.resolve();
        pendingRoomRef.current = null;
        return reportRef.current(rid)
            .then((ok) => {
                if (ok) lastReportAtRef.current = Date.now();
            })
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        const sendOwed = () => {
            const rid = pendingRoomRef.current;
            return rid ? flush(rid) : Promise.resolve();
        };
        owedReadSenders.add(sendOwed);
        return () => {
            owedReadSenders.delete(sendOwed);
        };
    }, [flush]);

    useEffect(() => {
        if (!roomId || !readOwed) return;
        const rid = String(roomId);
        pendingRoomRef.current = rid;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            void flush(rid);
        }, markReadDelayMs(Date.now() - lastReportAtRef.current));
    }, [roomId, readOwed, activityKey, flush]);

    useEffect(() => {
        if (!roomId) return;
        const rid = String(roomId);
        return () => {
            void flush(rid);
        };
    }, [roomId, flush]);

    // A reload or closed tab never runs the cleanup above, and hidden tabs throttle timers, so send any
    // owed read the moment the page is hidden or unloaded.
    useEffect(() => {
        const sendOwedNow = () => {
            const rid = pendingRoomRef.current;
            if (!rid) return;
            pendingRoomRef.current = null;
            if (reportOnExitRef.current) reportOnExitRef.current(rid);
            else void reportRef.current(rid).catch(() => undefined);
        };
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') sendOwedNow();
        };
        window.addEventListener('pagehide', sendOwedNow);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('pagehide', sendOwedNow);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);
}
