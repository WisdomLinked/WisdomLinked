import jwt from 'jsonwebtoken';

const secret = (): string =>
    String(process.env.MEETING_CHAT_SYNC_SECRET || process.env.JWT_SECRET || '').trim();

export type WlMeetingChatTokenClaims = {
    typ: 'wl-meeting-chat';
    sub: string;
    mid: string;
};

export type GuestMeetingChatTokenClaims = {
    typ: 'guest-meeting-chat';
    inv: string;
    mid: string;
    nm: string;
};

export type MeetingChatTokenClaims = WlMeetingChatTokenClaims | GuestMeetingChatTokenClaims;

export function signWlMeetingChatToken(userId: string, meetingThreadId: string, expiresInSeconds: number): string {
    const s = secret();
    if (!s) throw new Error('MEETING_CHAT_SYNC_SECRET or JWT_SECRET is required for meeting chat tokens');
    return jwt.sign(
        { typ: 'wl-meeting-chat', sub: String(userId), mid: String(meetingThreadId) } satisfies WlMeetingChatTokenClaims,
        s,
        { algorithm: 'HS256', expiresIn: Math.max(60, Math.min(expiresInSeconds, 48 * 60 * 60)) },
    );
}

export function signGuestMeetingChatToken(
    inviteId: string,
    meetingThreadId: string,
    displayName: string,
    expiresInSeconds: number,
): string {
    const s = secret();
    if (!s) throw new Error('MEETING_CHAT_SYNC_SECRET or JWT_SECRET is required for meeting chat tokens');
    const nm = String(displayName || 'Guest').trim().slice(0, 80) || 'Guest';
    return jwt.sign(
        { typ: 'guest-meeting-chat', inv: String(inviteId), mid: String(meetingThreadId), nm } satisfies GuestMeetingChatTokenClaims,
        s,
        { algorithm: 'HS256', expiresIn: Math.max(60, Math.min(expiresInSeconds, 48 * 60 * 60)) },
    );
}

export function verifyMeetingChatToken(token: string): MeetingChatTokenClaims | null {
    const s = secret();
    if (!s || !token) return null;
    try {
        const p = jwt.verify(String(token).trim(), s) as jwt.JwtPayload;
        if (p.typ === 'wl-meeting-chat' && typeof p.sub === 'string' && typeof p.mid === 'string') {
            return { typ: 'wl-meeting-chat', sub: p.sub, mid: p.mid };
        }
        if (
            p.typ === 'guest-meeting-chat'
            && typeof p.inv === 'string'
            && typeof p.mid === 'string'
            && typeof p.nm === 'string'
        ) {
            return { typ: 'guest-meeting-chat', inv: p.inv, mid: p.mid, nm: p.nm.slice(0, 80) };
        }
        return null;
    } catch {
        return null;
    }
}
