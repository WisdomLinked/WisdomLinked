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


/**
 * A meeting rating has to land in two places. `MeetingThread.ratings` keeps it next to
 * the call it describes; `User.feedbacks` is what the admin feedback page and the star
 * rating on a profile actually read. Only the first was ever written, so a rating was
 * saved correctly and then displayed nowhere.
 *
 * The entry shape below is the one `leaveFeedback` already writes and the admin page
 * already enriches — `otherUserId` is the rater, because the entry lives on the person
 * being rated. `meetingThreadId` is ours: it identifies the entry so that editing a
 * rating updates it instead of appending a second one and skewing the average.
 */
export type MeetingFeedbackEntry = {
    eventId: null;
    groupChatId: string | null;
    meetingThreadId: string;
    eventType: string;
    start: Date | null;
    end: Date | null;
    totalTimeSpent: number;
    rating: number;
    description: string;
    otherUserId: string;
    date: Date;
};

const asDate = (value: any): Date | null => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
};

export const buildMeetingFeedbackEntry = (params: {
    meeting: any;
    raterUserId: any;
    score: number;
    comment?: string;
    now?: Date;
}): MeetingFeedbackEntry => {
    const { meeting, raterUserId, score, comment, now = new Date() } = params;
    const groupChatId = meeting?.groupChatId
        ? String(meeting.groupChatId?._id ?? meeting.groupChatId)
        : null;
    return {
        eventId: null,
        groupChatId,
        meetingThreadId: String(meeting?._id ?? meeting?.id ?? ""),
        // Mirrors how the meeting itself is scoped, so the admin row reads sensibly.
        eventType: groupChatId ? "group-meeting" : "meeting",
        start: asDate(meeting?.startedAt),
        end: asDate(meeting?.endedAt),
        // `MeetingThread.duration` is seconds; every feedback surface renders
        // `totalTimeSpent` as minutes, so a 30 minute call must not read as 1800.
        totalTimeSpent: Math.round(Number(meeting?.duration || 0) / 60),
        rating: Math.round(Number(score)),
        description: String(comment || "").trim(),
        otherUserId: String(raterUserId?._id ?? raterUserId ?? ""),
        date: now,
    };
};

/**
 * Replaces the entry this rater already left for this meeting, or appends a new one.
 * Anything written by other flows (`leaveFeedback`) is passed through untouched.
 */
export const upsertMeetingFeedback = (
    existing: readonly any[] | null | undefined,
    entry: MeetingFeedbackEntry,
): any[] => {
    const list = Array.isArray(existing) ? [...existing] : [];
    const idx = list.findIndex(
        (f: any) =>
            f
            && String(f.meetingThreadId ?? "") === entry.meetingThreadId
            && String(f.otherUserId ?? "") === entry.otherUserId,
    );
    if (idx >= 0) {
        // Keep the original `date` so an edit does not look like a brand new review.
        list[idx] = { ...list[idx], ...entry, date: list[idx]?.date ?? entry.date };
        return list;
    }
    list.push(entry);
    return list;
};

/** Average of every feedback entry, to two decimals. Non-numeric ratings are ignored. */
export const averageFeedbackRating = (feedbacks: readonly any[] | null | undefined): number => {
    const scores = (Array.isArray(feedbacks) ? feedbacks : [])
        .map((f: any) => Number(f?.rating))
        .filter((n: number) => Number.isFinite(n) && n > 0);
    if (!scores.length) return 0;
    const avg = scores.reduce((sum: number, n: number) => sum + n, 0) / scores.length;
    return parseFloat(avg.toFixed(2));
};
