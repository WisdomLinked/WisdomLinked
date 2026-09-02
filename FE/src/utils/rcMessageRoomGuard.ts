/**
 * Guards Rocket.Chat stream handlers so messages from other rooms are not appended
 * to the currently open chat thread (privacy).
 */
export function shouldAppendRcStreamToActiveThread(
    msgRid: string | undefined | null,
    activeRid: string | undefined | null,
): boolean {
    const active = String(activeRid || '').trim();
    const incoming = String(msgRid || '').trim();
    if (!active) return false;
    if (!incoming) return false;
    return incoming === active;
}
