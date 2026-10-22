import { describe, expect, it } from 'vitest';
import { adminDmUnread, isUnknownDmRoom } from './adminDmUnread';

describe('adminDmUnread', () => {
    const dcs = [{ rcChannelId: 'dm-1' }, { rcChannelId: 'dm-2' }, { rcChannelId: '' }, null];

    it('totals unread across the admin direct messages', () => {
        expect(adminDmUnread(dcs, { 'dm-1': 2, 'dm-2': 3 })).toEqual({ total: 5, bySection: { direct: 5 } });
    });

    it('ignores rooms that are not the admin direct messages', () => {
        expect(adminDmUnread(dcs, { 'dm-1': 1, 'seminar-room': 7, 'community-room': 4 })).toEqual({
            total: 1,
            bySection: { direct: 1 },
        });
    });

    it('reports nothing when there is no unread', () => {
        expect(adminDmUnread(dcs, {})).toEqual({ total: 0, bySection: {} });
        expect(adminDmUnread(dcs, { 'dm-1': 0 })).toEqual({ total: 0, bySection: {} });
        expect(adminDmUnread(null, { 'dm-1': 3 })).toEqual({ total: 0, bySection: {} });
        expect(adminDmUnread(dcs, null)).toEqual({ total: 0, bySection: {} });
    });

    it('trims room ids on both sides', () => {
        expect(adminDmUnread([{ rcChannelId: ' dm-1 ' }], { 'dm-1': 2 }).total).toBe(2);
    });
});

describe('isUnknownDmRoom', () => {
    const dcs = [{ rcChannelId: 'dm-1' }];

    it('is false for a room the admin already has', () => {
        expect(isUnknownDmRoom(dcs, 'dm-1')).toBe(false);
    });

    it('is true for a room missing from the loaded conversations', () => {
        expect(isUnknownDmRoom(dcs, 'dm-9')).toBe(true);
        expect(isUnknownDmRoom(null, 'dm-9')).toBe(true);
    });

    it('is false for a blank room id', () => {
        expect(isUnknownDmRoom(dcs, '')).toBe(false);
        expect(isUnknownDmRoom(dcs, undefined)).toBe(false);
    });
});
