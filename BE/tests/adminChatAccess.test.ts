import test from 'node:test';
import assert from 'node:assert/strict';
import {
    adminRoomBaseFilter,
    adminRoomNameFilter,
    canUseGroupChat,
    collapseSeriesRooms,
    isChatAdminOf,
    isGroupParticipant,
    isPlatformAdmin,
    parseAdminRoomKind,
} from '../utils/adminChatAccess';

const admin = { _id: 'a1', role: 'admin' };
const student = { _id: 's1', role: 'customer' };

test('only the admin role counts as a platform admin', () => {
    assert.equal(isPlatformAdmin({ role: 'admin' }), true);
    assert.equal(isPlatformAdmin({ role: 'ADMIN' }), true);
    assert.equal(isPlatformAdmin({ role: 'expert' }), false);
    assert.equal(isPlatformAdmin({ role: 'customer' }), false);
    assert.equal(isPlatformAdmin(null), false);
});

test('a chat admin must both be an admin and have joined', () => {
    const room = { chatAdmins: ['a1'] };
    assert.equal(isChatAdminOf(room, admin), true);
    assert.equal(isChatAdminOf({ chatAdmins: [{ _id: 'a1' }] }, admin), true);
    assert.equal(isChatAdminOf({ chatAdmins: [] }, admin), false);
    assert.equal(isChatAdminOf({}, admin), false);
    assert.equal(isChatAdminOf({ chatAdmins: ['s1'] }, student), false);
});

test('the request user id field is honoured as well as _id', () => {
    assert.equal(isChatAdminOf({ chatAdmins: ['a9'] }, { userId: 'a9', role: 'admin' }), true);
});

test('participants and joined admins may use a group chat; nobody else', () => {
    const room = { participants: ['s1', { _id: 'e1' }], chatAdmins: ['a1'] };
    assert.equal(isGroupParticipant(room, 's1'), true);
    assert.equal(isGroupParticipant(room, 'e1'), true);
    assert.equal(canUseGroupChat(room, student), true);
    assert.equal(canUseGroupChat(room, admin), true);
    assert.equal(canUseGroupChat(room, { _id: 'x', role: 'customer' }), false);
    assert.equal(canUseGroupChat(room, { _id: 'a2', role: 'admin' }), false);
    assert.equal(canUseGroupChat(null, admin), false);
});

test('room kinds map to GroupChat types and only active rooms are searchable', () => {
    assert.equal(parseAdminRoomKind('appointment'), 'appointment');
    assert.equal(parseAdminRoomKind(' Seminar '), 'seminar');
    assert.equal(parseAdminRoomKind('community'), 'community');
    assert.equal(parseAdminRoomKind('dm'), null);
    assert.equal(parseAdminRoomKind(undefined), null);
    assert.deepEqual(adminRoomBaseFilter('appointment'), { type: 'individual', status: 'active' });
    assert.deepEqual(adminRoomBaseFilter('seminar'), { type: 'seminar', status: 'active' });
    assert.deepEqual(adminRoomBaseFilter('community'), { type: 'community', status: 'active' });
});

test('name search is case-insensitive, literal, and empty for blank input', () => {
    assert.equal(adminRoomNameFilter(''), null);
    assert.equal(adminRoomNameFilter('   '), null);
    assert.equal(adminRoomNameFilter(undefined), null);
    const f = adminRoomNameFilter('  Dev (Weekly)  ') as any;
    assert.equal(f.name.$options, 'i');
    assert.equal(f.name.$regex, 'Dev \\(Weekly\\)');
    assert.ok(new RegExp(f.name.$regex, 'i').test('weekly DEV (weekly) catchup'));
    assert.equal(new RegExp((adminRoomNameFilter('.*') as any).name.$regex).test('abc'), false);
});

test('name search input is capped', () => {
    const f = adminRoomNameFilter('x'.repeat(500)) as any;
    assert.equal(f.name.$regex.length, 80);
});

test('a recurring seminar collapses to its next occurrence, one-offs pass through', () => {
    const now = Date.parse('2026-10-11T00:00:00Z');
    const rooms = [
        { _id: 'p', seriesId: 'S', start: '2026-10-01T00:00:00Z' },
        { _id: 'one', start: '2026-10-20T00:00:00Z' },
        { _id: 'n2', seriesId: 'S', start: '2026-10-20T00:00:00Z' },
        { _id: 'n1', seriesId: 'S', start: '2026-10-13T00:00:00Z' },
    ];
    assert.deepEqual(collapseSeriesRooms(rooms, now).map((r) => r._id), ['n1', 'one']);
});

test('a series with no future occurrence keeps its latest one', () => {
    const now = Date.parse('2026-12-01T00:00:00Z');
    const rooms = [
        { _id: 'old', seriesId: 'S', start: '2026-10-01T00:00:00Z' },
        { _id: 'latest', seriesId: 'S', start: '2026-11-01T00:00:00Z' },
    ];
    assert.deepEqual(collapseSeriesRooms(rooms, now).map((r) => r._id), ['latest']);
});
