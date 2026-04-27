export const resolveMeetingRatingTargetUserId = (
    meetingLike: any,
    requesterUserId: string,
): string | null => {
    const requester = String(requesterUserId || "").trim();
    if (!requester) return null;

    const participants = Array.isArray(meetingLike?.participants)
        ? meetingLike.participants.map((p: any) => String(p?._id ?? p?.id ?? p)).filter(Boolean)
        : [];
    const startedBy = String(
        meetingLike?.startedBy?._id ?? meetingLike?.startedBy?.id ?? meetingLike?.startedBy ?? "",
    ).trim();

    const inMeeting = participants.includes(requester) || startedBy === requester;
    if (!inMeeting) return null;

    // Seminar/group calls: everyone rates the moderator only.
    if (meetingLike?.groupChatId) {
        if (!startedBy || startedBy === requester) return null;
        return startedBy;
    }

    // 1:1 calls: each participant rates the other participant.
    const unique = Array.from(new Set(participants));
    if (!unique.includes(requester)) unique.push(requester);
    const other = unique.find((uid) => uid !== requester);
    if (!other) return null;
    return other;
};

