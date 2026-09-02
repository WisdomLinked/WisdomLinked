import { parseMeetingMessageContent } from './meetingMessage';

export type EndedMeetingInfo = {
    duration: number;
    participantCount: number;
};

export type StartedMeetingInfo = {
    starterName: string;
    jitsiRoomName: string;
};

export function buildMeetingThreadMaps(messages: Array<{ content?: string }>): {
    endedMeetings: Map<string, EndedMeetingInfo>;
    startedMeetings: Map<string, StartedMeetingInfo>;
} {
    const endedMeetings = new Map<string, EndedMeetingInfo>();
    const startedMeetings = new Map<string, StartedMeetingInfo>();

    for (const message of messages) {
        const parsed = parseMeetingMessageContent(String(message.content || ''));
        if (!parsed) continue;
        if (parsed.type === 'ended') {
            endedMeetings.set(parsed.meetingThreadId, {
                duration: parsed.duration,
                participantCount: parsed.participantCount,
            });
        }
        if (parsed.type === 'started') {
            startedMeetings.set(parsed.meetingThreadId, {
                starterName: parsed.starterName,
                jitsiRoomName: parsed.jitsiRoomName,
            });
        }
    }

    return { endedMeetings, startedMeetings };
}
