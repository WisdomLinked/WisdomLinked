export type FeedbackMeetingKind = 'seminar' | 'individual' | 'community' | 'unknown';

export interface FeedbackMeetingDescriptor {
    kind: FeedbackMeetingKind;
    name: string | null;
}

const clean = (value: unknown): string | null => {
    const text = String(value ?? '').trim();
    return text ? text : null;
};

export const resolveFeedbackMeetingKind = (feedback: {
    eventType?: unknown;
    groupChat?: { name?: unknown; type?: unknown } | null;
    event?: { title?: unknown } | null;
    eventId?: unknown;
    groupChatId?: unknown;
}): FeedbackMeetingDescriptor => {
    const groupChatType = clean(feedback?.groupChat?.type);
    const groupChatName = clean(feedback?.groupChat?.name);
    if (groupChatType === 'seminar') return { kind: 'seminar', name: groupChatName };
    if (groupChatType === 'community') return { kind: 'community', name: groupChatName };
    if (groupChatType === 'individual') return { kind: 'individual', name: null };
    if (feedback?.event || feedback?.eventId) return { kind: 'individual', name: null };

    const eventType = clean(feedback?.eventType);
    if (eventType === 'seminar') return { kind: 'seminar', name: groupChatName };
    if (eventType === 'community') return { kind: 'community', name: groupChatName };
    if (eventType === 'individual' || eventType === 'meeting') {
        return { kind: 'individual', name: null };
    }

    return { kind: 'unknown', name: groupChatName };
};

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export const toLookupIds = (values: readonly unknown[]): string[] => {
    const out = new Set<string>();
    for (const value of values) {
        const id = String(value ?? '').trim();
        if (OBJECT_ID_RE.test(id)) out.add(id);
    }
    return [...out];
};

export const isLookupId = (value: unknown): boolean =>
    OBJECT_ID_RE.test(String(value ?? '').trim());
