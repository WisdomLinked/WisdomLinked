const normalizeId = (v: any): string => String(v?._id ?? v?.id ?? v ?? "").trim();

/**
 * Moderator policy:
 * - 1:1 meetings: only the user who started the meeting is moderator.
 * - Group meetings: only the group admin is moderator.
 */
export const isMeetingModerator = (params: {
    conversationId?: any;
    userId: any;
    startedBy?: any;
    groupAdminId?: any;
}): boolean => {
    const uid = normalizeId(params.userId);
    if (!uid) return false;
    if (params.conversationId) {
        return uid === normalizeId(params.startedBy);
    }
    return uid === normalizeId(params.groupAdminId);
};

