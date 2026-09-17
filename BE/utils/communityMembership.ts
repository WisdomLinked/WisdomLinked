const idOf = (value: unknown): string => {
    if (value == null) return '';
    const maybe = value as { _id?: unknown };
    return String(maybe?._id ?? value).trim();
};

export const hasJoinedCommunity = (
    community: { _id?: unknown; admin?: unknown; coModerators?: unknown } | null | undefined,
    userId: unknown,
    joinedChatIds: readonly unknown[] | null | undefined,
): boolean => {
    const me = idOf(userId);
    if (!me || !community) return false;

    const communityId = idOf(community._id);
    const joined = (joinedChatIds || []).map(idOf).filter(Boolean);
    if (communityId && joined.includes(communityId)) return true;

    if (idOf(community.admin) === me) return true;

    const coModerators = Array.isArray(community.coModerators) ? community.coModerators : [];
    return coModerators.map(idOf).includes(me);
};
