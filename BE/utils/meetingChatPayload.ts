import { Buffer } from 'node:buffer';

export type MeetingChatPayloadV1 = {
    v: 1;
    author: string;
    guest?: boolean;
    msg: string;
    /** WL Mongo user id of the poster (non-guest). */
    sub?: string;
};

export const MEETING_CHAT_MARKER = '__MEETING_CHAT__';

/** Rocket.Chat `msg` body for an in-meeting line mirrored into the parent DM/group thread. */
export function encodeMeetingChatLine(meetingThreadId: string, payload: MeetingChatPayloadV1): string {
    const json = JSON.stringify(payload);
    const b64 = Buffer.from(json, 'utf8').toString('base64url');
    return `${MEETING_CHAT_MARKER}::${meetingThreadId}::${b64}`;
}

export function decodeMeetingChatLine(line: string): { meetingThreadId: string; payload: MeetingChatPayloadV1 } | null {
    const prefix = `${MEETING_CHAT_MARKER}::`;
    if (!line.startsWith(prefix)) return null;
    const rest = line.slice(prefix.length);
    const sep = rest.indexOf('::');
    if (sep < 0) return null;
    const meetingThreadId = rest.slice(0, sep).trim();
    const b64 = rest.slice(sep + 2).trim();
    if (!meetingThreadId || !b64) return null;
    try {
        const json = Buffer.from(b64, 'base64url').toString('utf8');
        const payload = JSON.parse(json) as MeetingChatPayloadV1;
        if (payload?.v !== 1 || typeof payload.msg !== 'string' || typeof payload.author !== 'string') return null;
        return { meetingThreadId, payload };
    } catch {
        return null;
    }
}
