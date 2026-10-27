import test from 'node:test';
import assert from 'node:assert/strict';
import {
    WEEK_MS,
    combineSeriesSessions,
    communityMembers,
    computeCommunityActivity,
    isCountableMessage,
    weeksSince,
} from '../utils/communityActivity';

const slugs = (user: any) => [user?.email ? String(user.email).split('@')[0] : '', user?.rocketChatUsername || ''];

const owner = { _id: 'o1', username: 'Owner', email: 'owner@x.com', role: 'expert' };
const mod = { _id: 'm1', username: 'Mod', email: 'mod@x.com', role: 'customer' };
const student = { _id: 's1', username: 'Sam', email: 'sam@x.com', role: 'customer', rocketChatUsername: 'Sam.RC' };
const staff = { _id: 'a1', username: 'Staff', email: 'staff@x.com', role: 'admin' };

test('members are listed once each, strongest role first', () => {
    const members = communityMembers(
        { admin: owner, coModerators: [mod], participants: [owner, mod, student], chatAdmins: [staff, student] },
        slugs,
    );
    assert.deepEqual(members.map(m => [m._id, m.communityRole]), [
        ['o1', 'owner'],
        ['m1', 'co-moderator'],
        ['s1', 'member'],
        ['a1', 'platform-admin'],
    ]);
    assert.deepEqual(members[2].rcSlugs, ['sam', 'sam.rc']);
});

test('unpopulated ids and empty communities do not break the member list', () => {
    assert.deepEqual(communityMembers(null, slugs), []);
    const members = communityMembers({ admin: 'o1', participants: ['o1', 's1', null] }, slugs);
    assert.deepEqual(members.map(m => m._id), ['o1', 's1']);
    assert.equal(members[1].username, 'Member');
});

test('weeks never drop below one', () => {
    const now = Date.UTC(2026, 9, 26);
    assert.equal(weeksSince(new Date(now - 2 * 24 * 3600 * 1000), now), 1);
    assert.equal(weeksSince(new Date(now - 4 * WEEK_MS), now), 4);
    assert.equal(weeksSince(undefined, now), 1);
    assert.equal(weeksSince(new Date(now + WEEK_MS), now), 1);
});

test('only messages a person typed are counted', () => {
    assert.equal(isCountableMessage({ msg: 'hello', u: { username: 'sam' } }), true);
    assert.equal(isCountableMessage({ msg: 'sam', t: 'uj' }), false);
    assert.equal(isCountableMessage({ msg: '__WL_COMMUNITY_SYS__::x joined' }), false);
    assert.equal(isCountableMessage({ msg: '__MEETING_STARTED__:abc' }), false);
    assert.equal(isCountableMessage(null), false);
});

test('calls, messages and weekly averages per member', () => {
    const now = Date.UTC(2026, 9, 26);
    const members = communityMembers({ admin: owner, participants: [owner, student] }, slugs);
    const result = computeCommunityActivity({
        members,
        createdAt: new Date(now - 4 * WEEK_MS),
        now,
        meetings: [
            { startedBy: 'o1', joinEvents: [{ userId: 'o1' }, { userId: 's1' }, { userId: 's1' }] },
            { startedBy: { _id: 'o1' }, joinEvents: [] },
            { startedBy: 's1', joinEvents: [{ userId: 'o1' }] },
        ],
        messages: [
            { msg: 'hi', u: { username: 'owner' } },
            { msg: 'yo', u: { username: 'SAM.RC' } },
            { msg: 'again', u: { username: 'sam' } },
            { msg: 'sam', t: 'uj', u: { username: 'sam' } },
            { msg: 'from someone who left', u: { username: 'ghost' } },
        ],
    });
    const byId = Object.fromEntries(result.members.map(m => [m._id, m]));
    assert.deepEqual(byId.o1, { _id: 'o1', callsJoined: 3, callsStarted: 2, callsPerWeek: 0.8, messages: 1, messagesPerWeek: 0.3 });
    assert.deepEqual(byId.s1, { _id: 's1', callsJoined: 2, callsStarted: 1, callsPerWeek: 0.5, messages: 2, messagesPerWeek: 0.5 });
    assert.equal(result.totals.calls, 3);
    assert.equal(result.totals.callsPerWeek, 0.8);
    assert.equal(result.totals.messages, 4);
    assert.equal(result.totals.messagesFromOthers, 1);
    assert.equal(result.totals.weeks, 4);
    assert.equal(result.totals.since, new Date(now - 4 * WEEK_MS).toISOString());
});

test('unreadable history reports messages as unknown, not zero', () => {
    const members = communityMembers({ admin: owner, participants: [student] }, slugs);
    const result = computeCommunityActivity({ members, meetings: [], messages: null, createdAt: null, now: Date.now() });
    assert.equal(result.members[0].messages, null);
    assert.equal(result.members[0].messagesPerWeek, null);
    assert.equal(result.totals.messages, null);
    assert.equal(result.totals.messagesFromOthers, null);
    assert.equal(result.totals.calls, 0);
    assert.equal(result.totals.since, null);
});

test('a seminar series is combined into one group dated from its first session', () => {
    const combined = combineSeriesSessions([
        { _id: 'a', admin: owner, participants: [owner, student], createdAt: '2026-09-08T00:00:00.000Z' },
        { _id: 'b', admin: owner, participants: [owner, mod], createdAt: '2026-09-01T00:00:00.000Z' },
    ]);
    assert.equal(combined._id, 'a');
    assert.equal(new Date(combined.createdAt).toISOString(), '2026-09-01T00:00:00.000Z');
    assert.deepEqual(communityMembers(combined, slugs).map(m => m._id), ['o1', 's1', 'm1']);
    assert.equal(combineSeriesSessions([]), null);
});

