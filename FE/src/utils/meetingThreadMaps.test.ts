import { describe, expect, it } from 'vitest';
import { buildMeetingThreadMaps } from './meetingThreadMaps';

describe('buildMeetingThreadMaps', () => {
    it('indexes ended and started meetings by thread id', () => {
        const messages = [
            { content: '__MEETING_STARTED__::t1::room-a::Alice' },
            { content: '__MEETING_ENDED__::t1::120::2' },
            { content: '__MEETING_STARTED__::t2::room-b::Bob' },
        ];
        const { endedMeetings, startedMeetings } = buildMeetingThreadMaps(messages);
        expect(endedMeetings.get('t1')).toEqual({ duration: 120, participantCount: 2 });
        expect(startedMeetings.get('t1')?.starterName).toBe('Alice');
        expect(startedMeetings.get('t2')?.jitsiRoomName).toBe('room-b');
        expect(endedMeetings.has('t2')).toBe(false);
    });
});
