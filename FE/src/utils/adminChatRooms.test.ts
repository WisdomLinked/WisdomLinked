import { describe, expect, it } from 'vitest';
import {
    adminRoomKindForSection,
    adminSearchExtras,
    adminSearchSubtitle,
    appointmentPeopleLabel,
    isAdminAuthor,
    isChatAdminViewer,
    mergeAdminRooms,
} from './adminChatRooms';

describe('adminRoomKindForSection', () => {
    it('maps each group section to its room kind and nothing else', () => {
        expect(adminRoomKindForSection('appointments')).toBe('appointment');
        expect(adminRoomKindForSection('seminars')).toBe('seminar');
        expect(adminRoomKindForSection('communities')).toBe('community');
        expect(adminRoomKindForSection('direct')).toBeNull();
        expect(adminRoomKindForSection('none')).toBeNull();
    });
});

describe('mergeAdminRooms', () => {
    it('appends joined rooms the user does not already have, once', () => {
        const own = [{ _id: 'a' }, { _id: 'b' }];
        const merged = mergeAdminRooms(own, [{ _id: 'b' }, { _id: 'c' }]);
        expect(merged.map((r) => r._id)).toEqual(['a', 'b', 'c']);
    });
    it('returns the same list when there is nothing to add', () => {
        const own = [{ _id: 'a' }];
        expect(mergeAdminRooms(own, [])).toBe(own);
        expect(mergeAdminRooms(undefined, undefined)).toEqual([]);
    });
});

describe('appointmentPeopleLabel', () => {
    it('names both people, host included once', () => {
        const room = {
            participants: [{ _id: 's', username: 'Asha' }, { _id: 'e', username: 'Dr Lee' }],
            admin: { _id: 'e', username: 'Dr Lee' },
        };
        expect(appointmentPeopleLabel(room)).toBe('Asha & Dr Lee');
    });
    it('falls back to email and adds a host missing from participants', () => {
        const room = { participants: [{ _id: 's', email: 's@x.com' }], admin: { _id: 'e', username: 'Dr Lee' } };
        expect(appointmentPeopleLabel(room)).toBe('s@x.com & Dr Lee');
    });
    it('is empty when nobody is known', () => {
        expect(appointmentPeopleLabel({})).toBe('');
    });
});

describe('adminSearchExtras', () => {
    const results = [
        { _id: '1', name: 'A', type: 'seminar', joined: false },
        { _id: '2', name: 'B', type: 'seminar', joined: true },
        { _id: '3', name: 'C', type: 'seminar', joined: false },
        { _id: '4', name: 'D', type: 'seminar', seriesId: 'S', joined: false },
    ];
    it('drops joined hits, hits already listed, and other occurrences of a listed series', () => {
        const listed = [{ _id: '3' }, { _id: '9', raw: { seriesId: 'S' } }];
        expect(adminSearchExtras(results, listed).map((r) => r._id)).toEqual(['1']);
    });
    it('keeps everything new when nothing is listed', () => {
        expect(adminSearchExtras(results, []).map((r) => r._id)).toEqual(['1', '3', '4']);
        expect(adminSearchExtras(null, [])).toEqual([]);
    });
});

describe('adminSearchSubtitle', () => {
    it('names both people on an appointment', () => {
        expect(
            adminSearchSubtitle('appointment', {
                _id: 'x', name: 'n', type: 'individual',
                people: [{ _id: 's', username: 'Asha' }, { _id: 'e', username: 'Dr Lee' }],
                host: { _id: 'e', username: 'Dr Lee' },
            }),
        ).toBe('Asha & Dr Lee');
    });
    it('shows the host and date on a seminar', () => {
        const label = adminSearchSubtitle('seminar', {
            _id: 'x', name: 'n', type: 'seminar', host: { username: 'Dr Lee' }, start: '2026-10-20T12:00:00Z',
        });
        expect(label.startsWith('Hosted by Dr Lee · ')).toBe(true);
        expect(label).toMatch(/2026/);
    });
    it('marks a community open or invite-only', () => {
        expect(adminSearchSubtitle('community', { _id: 'x', name: 'n', type: 'community', titleLine: 'Grad help', isOpenToAll: false }))
            .toBe('Grad help · Invite only');
        expect(adminSearchSubtitle('community', { _id: 'x', name: 'n', type: 'community', isOpenToAll: true })).toBe('Open to all');
    });
});

describe('isAdminAuthor', () => {
    it('is true only for the admin role', () => {
        expect(isAdminAuthor({ role: 'admin' })).toBe(true);
        expect(isAdminAuthor({ role: 'Admin' })).toBe(true);
        expect(isAdminAuthor({ role: 'expert' })).toBe(false);
        expect(isAdminAuthor({ role: 'user' })).toBe(false);
        expect(isAdminAuthor(null)).toBe(false);
    });
});

describe('isChatAdminViewer', () => {
    const room = { chatAdmins: [{ _id: 'a1', role: 'admin' }] };
    it('is true for an admin listed as a chat admin, populated or bare id', () => {
        expect(isChatAdminViewer(room, { _id: 'a1', role: 'admin' })).toBe(true);
        expect(isChatAdminViewer({ chatAdmins: ['a1'] }, { _id: 'a1', role: 'admin' })).toBe(true);
    });
    it('is false for members, other admins, and non-admins', () => {
        expect(isChatAdminViewer(room, { _id: 'a2', role: 'admin' })).toBe(false);
        expect(isChatAdminViewer(room, { _id: 'a1', role: 'expert' })).toBe(false);
        expect(isChatAdminViewer({ chatAdmins: [] }, { _id: 'a1', role: 'admin' })).toBe(false);
        expect(isChatAdminViewer({}, { _id: 'a1', role: 'admin' })).toBe(false);
        expect(isChatAdminViewer(null, { _id: 'a1', role: 'admin' })).toBe(false);
        expect(isChatAdminViewer(room, null)).toBe(false);
    });
});
