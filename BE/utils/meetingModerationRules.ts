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

