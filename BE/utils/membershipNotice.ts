/**
 * Wording for the "X has joined / left …" lines shown in a group chat. Rocket.Chat records the
 * same join and leave events in community, seminar and 1:1 appointment rooms, so the line has to
 * name the right kind of chat. Mirrors `membershipNotice` in FE/src/utils/communityChatMessages.ts.
 */
export function membershipNoun(groupType?: string | null): string {
    if (groupType === 'seminar') return 'seminar';
    if (groupType === 'individual') return '1:1 appointment';
    return 'community';
}

export function membershipNotice(label: string, side: 'join' | 'leave', groupType?: string | null): string {
    return `${label} has ${side === 'join' ? 'joined' : 'left'} the ${membershipNoun(groupType)}.`;
}
