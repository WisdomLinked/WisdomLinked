/**
 * Activity statistics for one community or seminar, as shown in the admin audit view.
 * Pure: the controller loads the community, its meetings and the Rocket.Chat
 * history, and this file only decides who the members are and what counts.
 */

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type CommunityMemberRole = 'owner' | 'co-moderator' | 'member' | 'platform-admin';

export type CommunityMember = {
    _id: string;
    username: string;
    email: string;
    image: string;
    role: string;
    status: string;
    communityRole: CommunityMemberRole;
    /** Rocket.Chat logins this person may post under, lower-cased. */
    rcSlugs: string[];
};

export type MemberActivity = {
    _id: string;
    callsJoined: number;
    callsStarted: number;
    callsPerWeek: number;
    messages: number | null;
    messagesPerWeek: number | null;
};

export type CommunityActivityTotals = {
    calls: number;
    callsPerWeek: number;
    messages: number | null;
    messagesPerWeek: number | null;
    /** Messages whose author is no longer a member (or never resolved to one). */
    messagesFromOthers: number | null;
    weeks: number;
    since: string | null;
};

const idOf = (value: unknown): string => {
    if (value == null) return '';
    const maybe = value as { _id?: unknown };
    return String(maybe?._id ?? value).trim();
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * Everyone who belongs to the community, each once, strongest role first.
 * The owner is also stored inside `participants` on every community, so a
 * plain concatenation would list them twice.
 */
export function communityMembers(
    community: { admin?: unknown; coModerators?: unknown; participants?: unknown; chatAdmins?: unknown } | null | undefined,
    slugsFor: (user: any) => string[],
): CommunityMember[] {
    if (!community) return [];
    const ordered: Array<[unknown, CommunityMemberRole]> = [
        [community.admin, 'owner'],
        ...asArray(community.coModerators).map(user => [user, 'co-moderator'] as [unknown, CommunityMemberRole]),
        ...asArray(community.participants).map(user => [user, 'member'] as [unknown, CommunityMemberRole]),
        ...asArray(community.chatAdmins).map(user => [user, 'platform-admin'] as [unknown, CommunityMemberRole]),
    ];
    const seen = new Set<string>();
    const members: CommunityMember[] = [];
    for (const [user, communityRole] of ordered) {
        const id = idOf(user);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const doc = (user && typeof user === 'object' ? user : {}) as any;
        members.push({
            _id: id,
            username: String(doc.username || doc.email || 'Member'),
            email: String(doc.email || ''),
            image: String(doc.image || ''),
            role: String(doc.role || ''),
            status: String(doc.status || ''),
            communityRole,
            rcSlugs: [...new Set(slugsFor(doc).map(slug => String(slug || '').trim().toLowerCase()).filter(Boolean))],
        });
    }
    return members;
}

/**
 * One group out of every session of a seminar series, which share one chat room
 * and one set of calls: everyone who attended any session, dated from the first.
 */
export function combineSeriesSessions(sessions: any[]): any | null {
    const list = (sessions || []).filter(Boolean);
    if (!list.length) return null;
    const times = list
        .map(doc => (doc?.createdAt ? new Date(doc.createdAt).getTime() : NaN))
        .filter(Number.isFinite);
    return {
        ...list[0],
        coModerators: list.flatMap(doc => asArray(doc?.coModerators)),
        participants: list.flatMap(doc => asArray(doc?.participants)),
        chatAdmins: list.flatMap(doc => asArray(doc?.chatAdmins)),
        createdAt: times.length ? new Date(Math.min(...times)) : list[0]?.createdAt,
    };
}

/** Weeks the community has existed. Never below one, so a new community is not over-stated. */
export function weeksSince(createdAt: unknown, now: number): number {
    const start = createdAt ? new Date(createdAt as any).getTime() : NaN;
    if (!Number.isFinite(start) || start >= now) return 1;
    return Math.max(1, (now - start) / WEEK_MS);
}

const perWeek = (count: number, weeks: number): number => Math.round((count / weeks) * 10) / 10;

/** Rocket.Chat entries that are not something a person typed into the chat. */
export function isCountableMessage(message: any): boolean {
    if (!message) return false;
    const subtype = String(message.t ?? '').trim();
    if (subtype) return false;
    const text = String(message.msg ?? '');
    if (text.startsWith('__WL_COMMUNITY_SYS__::')) return false;
    if (text.startsWith('__MEETING_')) return false;
    return true;
}

export function computeCommunityActivity({
    members,
    meetings,
    messages,
    createdAt,
    now,
}: {
    members: CommunityMember[];
    meetings: Array<{ startedBy?: unknown; joinEvents?: unknown }>;
    /** Full Rocket.Chat history, or null when it could not be read. */
    messages: any[] | null;
    createdAt: unknown;
    now: number;
}): { members: MemberActivity[]; totals: CommunityActivityTotals } {
    const weeks = weeksSince(createdAt, now);
    const joined = new Map<string, number>();
    const started = new Map<string, number>();
    for (const meeting of meetings || []) {
        const host = idOf(meeting?.startedBy);
        const attendees = new Set<string>(
            asArray(meeting?.joinEvents).map(event => idOf((event as any)?.userId)).filter(Boolean),
        );
        if (host) {
            attendees.add(host);
            started.set(host, (started.get(host) || 0) + 1);
        }
        for (const id of attendees) joined.set(id, (joined.get(id) || 0) + 1);
    }

    const memberBySlug = new Map<string, string>();
    for (const member of members) {
        for (const slug of member.rcSlugs) if (!memberBySlug.has(slug)) memberBySlug.set(slug, member._id);
    }
    const sent = new Map<string, number>();
    let countedMessages = 0;
    let fromOthers = 0;
    if (messages) {
        for (const message of messages) {
            if (!isCountableMessage(message)) continue;
            countedMessages += 1;
            const slug = String(message?.u?.username ?? '').trim().toLowerCase();
            const memberId = slug ? memberBySlug.get(slug) : undefined;
            if (memberId) sent.set(memberId, (sent.get(memberId) || 0) + 1);
            else fromOthers += 1;
        }
    }

    const calls = (meetings || []).length;
    const start = createdAt ? new Date(createdAt as any) : null;
    return {
        members: members.map(member => {
            const callsJoined = joined.get(member._id) || 0;
            const count = messages ? sent.get(member._id) || 0 : null;
            return {
                _id: member._id,
                callsJoined,
                callsStarted: started.get(member._id) || 0,
                callsPerWeek: perWeek(callsJoined, weeks),
                messages: count,
                messagesPerWeek: count == null ? null : perWeek(count, weeks),
            };
        }),
        totals: {
            calls,
            callsPerWeek: perWeek(calls, weeks),
            messages: messages ? countedMessages : null,
            messagesPerWeek: messages ? perWeek(countedMessages, weeks) : null,
            messagesFromOthers: messages ? fromOthers : null,
            weeks: Math.round(weeks * 10) / 10,
            since: start && !Number.isNaN(start.getTime()) ? start.toISOString() : null,
        },
    };
}
