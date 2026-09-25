import { describe, expect, it } from 'vitest';
import {
    lastActivityAt,
    sortByRecentActivity,
    toActivityMs,
    withRoomActivity,
} from './chatListOrder';

const row = (id: string, roomId?: string | null, storedAt?: unknown) => ({ id, roomId, storedAt });
const resolve = (r: ReturnType<typeof row>) => ({ roomId: r.roomId, storedAt: r.storedAt });
const ids = (rows: ReturnType<typeof row>[]) => rows.map(r => r.id);

describe('toActivityMs', () => {
    it('reads dates, ISO strings and epoch numbers', () => {
        expect(toActivityMs(new Date(5000))).toBe(5000);
        expect(toActivityMs('2026-09-25T10:00:00.000Z')).toBe(Date.parse('2026-09-25T10:00:00.000Z'));
        expect(toActivityMs(5000)).toBe(5000);
    });

    it('treats an absent value as no activity rather than as the epoch', () => {
        expect(toActivityMs(null)).toBeNull();
        expect(toActivityMs(undefined)).toBeNull();
        expect(toActivityMs('')).toBeNull();
        expect(toActivityMs('not a date')).toBeNull();
        expect(toActivityMs(new Date('nonsense'))).toBeNull();
    });
});

describe('lastActivityAt', () => {
    it('prefers whichever of stored and live is later', () => {
        expect(lastActivityAt(1000, 2000)).toBe(2000);
        expect(lastActivityAt(3000, 2000)).toBe(3000);
    });

    it('works when only one of the two exists', () => {
        expect(lastActivityAt(null, 2000)).toBe(2000);
        expect(lastActivityAt(1000, null)).toBe(1000);
        expect(lastActivityAt(null, null)).toBeNull();
    });
});

describe('sortByRecentActivity', () => {
    it('puts the most recent conversation first', () => {
        const rows = [
            row('old', 'r1', new Date(1000)),
            row('newest', 'r2', new Date(3000)),
            row('middle', 'r3', new Date(2000)),
        ];
        expect(ids(sortByRecentActivity(rows, resolve))).toEqual(['newest', 'middle', 'old']);
    });

    it('lets a message arriving now jump a chat to the top', () => {
        const rows = [
            row('quiet', 'r1', new Date(9000)),
            row('justMessaged', 'r2', new Date(1000)),
        ];
        const sorted = sortByRecentActivity(rows, resolve, { r2: 10000 });
        expect(ids(sorted)).toEqual(['justMessaged', 'quiet']);
    });

    it('sinks rows that have never had a message below the ones that have', () => {
        const rows = [
            row('contactA', null, null),
            row('chat', 'r1', new Date(1000)),
            row('contactB', null, null),
        ];
        expect(ids(sortByRecentActivity(rows, resolve))).toEqual(['chat', 'contactA', 'contactB']);
    });

    it('keeps the incoming order among rows with no activity', () => {
        const rows = [row('a'), row('b'), row('c')];
        expect(ids(sortByRecentActivity(rows, resolve))).toEqual(['a', 'b', 'c']);
    });

    it('keeps the incoming order when two chats share a timestamp', () => {
        const rows = [
            row('first', 'r1', new Date(2000)),
            row('second', 'r2', new Date(2000)),
        ];
        expect(ids(sortByRecentActivity(rows, resolve))).toEqual(['first', 'second']);
    });

    it('ignores live activity for a room the list does not show', () => {
        const rows = [row('only', 'r1', new Date(1000))];
        expect(ids(sortByRecentActivity(rows, resolve, { somewhereElse: 99999 }))).toEqual(['only']);
    });

    it('does not mutate the array it was given', () => {
        const rows = [row('a', 'r1', new Date(1000)), row('b', 'r2', new Date(2000))];
        const copy = [...rows];
        sortByRecentActivity(rows, resolve);
        expect(rows).toEqual(copy);
    });

    it('returns an empty list unchanged', () => {
        expect(sortByRecentActivity([], resolve)).toEqual([]);
    });
});

describe('withRoomActivity', () => {
    it('records activity for a room', () => {
        expect(withRoomActivity({}, 'r1', 1000)).toEqual({ r1: 1000 });
    });

    it('keeps the newest timestamp when an older one arrives late', () => {
        expect(withRoomActivity({ r1: 2000 }, 'r1', 1000)).toEqual({ r1: 2000 });
    });

    it('returns the same object when nothing changes, so React can skip a render', () => {
        const current = { r1: 2000 };
        expect(withRoomActivity(current, 'r1', 1000)).toBe(current);
        expect(withRoomActivity(current, '', 5000)).toBe(current);
        expect(withRoomActivity(current, 'r2', null)).toBe(current);
    });

    it('leaves other rooms alone', () => {
        expect(withRoomActivity({ r1: 1000 }, 'r2', 2000)).toEqual({ r1: 1000, r2: 2000 });
    });
});
