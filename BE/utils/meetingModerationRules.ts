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
    const meRole = String(meLike?.role || "").toLowerCase();
    const adminId = normalizeId(groupChatLike?.admin);
    const coModeratorIds = Array.isArray(groupChatLike?.coModerators)
        ? groupChatLike.coModerators.map((p: any) => normalizeId(p)).filter(Boolean)
        : [];
    const participants = Array.isArray(groupChatLike?.participants)
        ? groupChatLike.participants.map((p: any) => normalizeId(p)).filter(Boolean)
        : [];
    const isParticipant = participants.includes(meId) || adminId === meId;
    if (!isParticipant) return false;

    const type = String(groupChatLike?.type || "").toLowerCase();
    // Community + seminar moderation must be moderator-led (admin or co-moderator).
    if (type === "community" || type === "seminar") {
        const isModerator = adminId === meId || coModeratorIds.includes(meId);
        return isModerator && (meRole === "expert" || coModeratorIds.includes(meId));
    }
    // 1:1 group-like calls keep existing behavior (either participant).
    return true;
};

