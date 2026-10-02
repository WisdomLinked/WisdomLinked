const normalizeId = (v: any): string => String(v?._id ?? v?.id ?? v ?? "").trim();

export const buildMeetingRoomName = (
    scopeId: string,
    nowMs: number = Date.now(),
    randomHex: string = "",
): string => {
    const safeScope = String(scopeId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    const rand = String(randomHex || "").trim() || Math.random().toString(16).slice(2, 8);
    return `wl-${safeScope}-${nowMs}-${rand}`;
};

export const canStartGroupMeeting = (groupChatLike: any, meLike: any): boolean => {
    if (!groupChatLike || !meLike) return false;
    const meId = normalizeId(meLike);
    const adminId = normalizeId(groupChatLike?.admin);
    const participants = Array.isArray(groupChatLike?.participants)
        ? groupChatLike.participants.map((p: any) => normalizeId(p)).filter(Boolean)
        : [];
    const coModerators = Array.isArray(groupChatLike?.coModerators)
        ? groupChatLike.coModerators.map((p: any) => normalizeId(p)).filter(Boolean)
        : [];
    const isParticipant = participants.includes(meId) || adminId === meId;
    if (!isParticipant) return false;
    if (String(groupChatLike?.type || "").toLowerCase() === "community") {
        return adminId === meId || coModerators.includes(meId);
    }
    // Seminar/individual policy: only group admin can initiate the call.
    return adminId === meId;
};

export const canEndMeetingAsLastParticipant = (
    meetingLike: {
        lastHeartbeatAt?: Date | string | number | null;
        lastReportedRemoteCount?: number | null;
    } | null | undefined,
    nowMs: number = Date.now(),
    heartbeatFreshMs: number = 90_000,
): boolean => {
    if (!meetingLike) return false;

    const raw = meetingLike.lastHeartbeatAt;
    const lastAt = raw ? new Date(raw as any).getTime() : 0;
    if (!lastAt || !Number.isFinite(lastAt)) return false;
    if (nowMs - lastAt > heartbeatFreshMs) return false;

    // Guard the null/undefined case explicitly: Number(null) is 0, which would read a
    // missing head count as "the room is empty" — the very claim we are verifying.
    const remoteRaw = meetingLike.lastReportedRemoteCount;
    if (remoteRaw === null || remoteRaw === undefined) return false;
    const remote = Number(remoteRaw);
    if (!Number.isFinite(remote)) return false;

    return remote <= 0;
};
