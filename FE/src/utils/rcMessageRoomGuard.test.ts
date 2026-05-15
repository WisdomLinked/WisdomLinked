import { describe, expect, it } from 'vitest';
import { shouldAppendRcStreamToActiveThread } from './rcMessageRoomGuard';

describe('shouldAppendRcStreamToActiveThread', () => {
    it('allows append when room ids match', () => {
        expect(shouldAppendRcStreamToActiveThread('room-a', 'room-a')).toBe(true);
    });

    it('blocks append when room ids differ', () => {
        expect(shouldAppendRcStreamToActiveThread('room-b', 'room-a')).toBe(false);
    });

    it('blocks append when incoming rid is missing', () => {
        expect(shouldAppendRcStreamToActiveThread('', 'room-a')).toBe(false);
        expect(shouldAppendRcStreamToActiveThread(null, 'room-a')).toBe(false);
    });

    it('blocks append when no active room', () => {
        expect(shouldAppendRcStreamToActiveThread('room-a', '')).toBe(false);
    });
});
