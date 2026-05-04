const normalizeId = (v: any): string => String(v?._id ?? v?.id ?? v ?? "").trim();

/**
 * Moderator policy:
 * - 1:1 meetings: user who started the meeting is moderator; others may be promoted via `delegatedModerators`.
 * - Group meetings: group admin is moderator; others may be promoted via `delegatedModerators`.
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

/** Meeting starter / group admin, or promoted via POST /meeting/delegate-moderator. */
export const isMeetingModeratorWithDelegates = (params: {
    conversationId?: any;
    userId: any;
    startedBy?: any;
    groupAdminId?: any;
    delegatedModeratorIds?: readonly any[];
}): boolean => {
    if (isMeetingModerator(params)) return true;
    const uid = normalizeId(params.userId);
    if (!uid || !params.delegatedModeratorIds?.length) return false;
    return params.delegatedModeratorIds.some((id) => normalizeId(id) === uid);
};

