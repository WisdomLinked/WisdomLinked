/** True when Rocket.Chat rejected the request because the auth token/session is invalid or expired. */
export function isRcAuthError(err: unknown): boolean {
    const e = err as { response?: { status?: number; data?: { error?: string; message?: string } }; message?: string };
    const status = e?.response?.status;
    const msg = String(e?.response?.data?.error || e?.response?.data?.message || e?.message || '').toLowerCase();
    return status === 401 || /must be logged in|invalid user|unauthorized/.test(msg);
}
