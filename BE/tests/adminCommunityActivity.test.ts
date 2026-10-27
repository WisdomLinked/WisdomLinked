import test from 'node:test';
import assert from 'node:assert/strict';

const rocket = require('../services/rocketchat.service');
const rc = {
    history: [] as any[],
    fail: false,
    lookupFails: false,
    calls: [] as Array<[string, number, number]>,
    lookups: [] as string[],
    synced: 0,
};
require.cache[require.resolve('../services/rocketchat.service')]!.exports = {
    ...rocket,
    findGroupChannelIdReadOnly: async (key: string) => {
        rc.lookups.push(key);
        if (rc.lookupFails) throw new Error('rc unreachable');
        return 'room-from-name';
    },
    getRCChannelHistoryAsAdmin: async (roomId: string, count: number, offset: number) => {
        rc.calls.push([roomId, count, offset]);
        if (rc.fail) throw new Error('rc down');
        return rc.history.slice(offset, offset + count);
    },
    syncRocketGroupChannelMembers: async () => {
        rc.synced += 1;
        return 'should-not-be-used';
    },
};

const { getGroupChatActivity, getGroupChatHistory } = require('../controllers/admin.controller');
const GroupChat = require('../models/GroupChat');
const MeetingThread = require('../models/MeetingThread');
const User = require('../models/User');

const OWNER = { _id: '507f1f77bcf86cd799439011', username: 'Owner', email: 'owner@x.com', role: 'expert' };
const STUDENT = { _id: '507f1f77bcf86cd799439012', username: 'Sam', email: 'sam@x.com', role: 'customer' };
const COMMUNITY_ID = '507f1f77bcf86cd799439099';

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    send(body: any) { this.body = body; return this; },
});

const chain = (value: any) => {
    const c: any = { populate: () => c, lean: () => c, select: () => c, then: (ok: any, bad: any) => Promise.resolve(value).then(ok, bad) };
    return c;
};

const community = (extra: any = {}) => ({
    _id: COMMUNITY_ID,
    type: 'community',
    name: 'Cohort',
    description: 'About us',
    isOpenToAll: true,
    createdAt: new Date(Date.now() - 2 * 7 * 24 * 3600 * 1000),
    admin: OWNER,
    participants: [OWNER, STUDENT],
    coModerators: [],
    chatAdmins: [],
    keywords: [{ label: 'CS' }],
    services: [],
    rcChannelId: 'room-1',
    ...extra,
});

const reset = (t: any) => {
    rc.history = [];
    rc.fail = false;
    rc.lookupFails = false;
    rc.calls = [];
    rc.lookups = [];
    rc.synced = 0;
    t.mock.method(User, 'find', () => chain([]));
};

const slug = (email: string) => rocket.toRocketChatUsername(email);

test('community activity counts calls and messages per member without touching room membership', async t => {
    reset(t);
    t.mock.method(GroupChat, 'findOne', () => chain(community()));
    t.mock.method(MeetingThread, 'find', () => chain([
        { startedBy: OWNER._id, joinEvents: [{ userId: OWNER._id }, { userId: STUDENT._id }] },
        { startedBy: STUDENT._id, joinEvents: [] },
    ]));
    rc.history = [
        { _id: 'a', msg: 'hi', u: { username: slug(OWNER.email) } },
        { _id: 'b', msg: 'hello', u: { username: slug(STUDENT.email) } },
        { _id: 'c', msg: 'again', u: { username: slug(STUDENT.email) } },
        { _id: 'd', msg: slug(STUDENT.email), t: 'uj', u: { username: slug(STUDENT.email) } },
    ];
    const res = makeRes();
    await getGroupChatActivity({ body: { groupChatId: COMMUNITY_ID } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.messagesAvailable, true);
    assert.equal(res.body.community.description, 'About us');
    assert.deepEqual(res.body.community.keywords, [{ label: 'CS' }]);
    const byId = Object.fromEntries(res.body.members.map((m: any) => [m._id, m]));
    assert.equal(byId[OWNER._id].communityRole, 'owner');
    assert.equal(byId[OWNER._id].callsJoined, 1);
    assert.equal(byId[OWNER._id].callsStarted, 1);
    assert.equal(byId[OWNER._id].messages, 1);
    assert.equal(byId[STUDENT._id].callsJoined, 2);
    assert.equal(byId[STUDENT._id].messages, 2);
    assert.equal(res.body.totals.calls, 2);
    assert.equal(res.body.totals.messages, 3);
    assert.equal('rcSlugs' in byId[OWNER._id], false, 'internal login slugs are not sent to the browser');
    assert.equal(res.body.members.length, 2, 'the owner listed in participants is not counted twice');
    assert.deepEqual(rc.calls[0], ['room-1', 100, 0]);
    assert.equal(rc.synced, 0);
});

test('community activity reads every page of a long history', async t => {
    reset(t);
    t.mock.method(GroupChat, 'findOne', () => chain(community()));
    t.mock.method(MeetingThread, 'find', () => chain([]));
    rc.history = Array.from({ length: 230 }, (_, i) => ({ _id: `m${i}`, msg: 'x', u: { username: slug(STUDENT.email) } }));
    const res = makeRes();
    await getGroupChatActivity({ body: { groupChatId: COMMUNITY_ID } }, res);
    assert.deepEqual(rc.calls.map(call => call[2]), [0, 100, 200]);
    assert.equal(res.body.totals.messages, 230);
    assert.equal(res.body.messagesCapped, false);
});

test('when Rocket.Chat is down the calls still show and messages are marked unavailable', async t => {
    reset(t);
    rc.fail = true;
    t.mock.method(GroupChat, 'findOne', () => chain(community()));
    t.mock.method(MeetingThread, 'find', () => chain([{ startedBy: OWNER._id, joinEvents: [] }]));
    const res = makeRes();
    await getGroupChatActivity({ body: { groupChatId: COMMUNITY_ID } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.messagesAvailable, false);
    assert.equal(res.body.totals.calls, 1);
    assert.equal(res.body.totals.messages, null);
    assert.equal(res.body.members[0].messages, null);
});

test('community activity looks the room up by name only when no id is stored', async t => {
    reset(t);
    t.mock.method(GroupChat, 'findOne', () => chain(community({ rcChannelId: null })));
    t.mock.method(MeetingThread, 'find', () => chain([]));
    const res = makeRes();
    await getGroupChatActivity({ body: { groupChatId: COMMUNITY_ID } }, res);
    assert.deepEqual(rc.lookups, [COMMUNITY_ID]);
    assert.equal(rc.calls[0][0], 'room-from-name');
    assert.equal(rc.synced, 0);
});

test('community activity refuses a bad id and an unknown community without logging the admin out', async t => {
    reset(t);
    const bad = makeRes();
    await getGroupChatActivity({ body: { groupChatId: 'nope' } }, bad);
    assert.equal(bad.statusCode, 400);

    t.mock.method(GroupChat, 'findOne', () => chain(null));
    const missing = makeRes();
    await getGroupChatActivity({ body: { groupChatId: COMMUNITY_ID } }, missing);
    assert.equal(missing.statusCode, 404);
});

test('admin group history comes from Rocket.Chat, oldest first, one page at a time', async t => {
    reset(t);
    t.mock.method(GroupChat, 'findById', () => chain(community()));
    rc.history = [
        { _id: 'new', msg: 'second', ts: '2026-10-02T10:00:00.000Z', u: { username: slug(STUDENT.email) } },
        { _id: 'old', msg: 'first', ts: '2026-10-01T10:00:00.000Z', u: { username: slug(OWNER.email) } },
    ];
    const res = makeRes();
    await getGroupChatHistory({ body: { groupChatId: COMMUNITY_ID, currentPage: 0 } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.result.map((m: any) => m.content), ['first', 'second']);
    assert.equal(String(res.body.result[0].author._id), OWNER._id);
    assert.equal(res.body.gotAllChats, true);
    assert.deepEqual(rc.calls[0], ['room-1', 20, 0]);

    rc.calls = [];
    rc.history = Array.from({ length: 45 }, (_, i) => ({ _id: `m${i}`, msg: `m${i}`, ts: new Date(2026, 9, 1, 0, i).toISOString(), u: { username: 'x' } }));
    const second = makeRes();
    await getGroupChatHistory({ body: { groupChatId: COMMUNITY_ID, currentPage: 1 } }, second);
    assert.deepEqual(rc.calls[0], ['room-1', 20, 20]);
    assert.equal(second.body.gotAllChats, false);
    assert.equal(rc.synced, 0);
});

test('admin group history reports a Rocket.Chat failure as an error, not an empty chat', async t => {
    reset(t);
    rc.fail = true;
    t.mock.method(GroupChat, 'findById', () => chain(community()));
    const res = makeRes();
    await getGroupChatHistory({ body: { groupChatId: COMMUNITY_ID, currentPage: 0 } }, res);
    assert.equal(res.statusCode, 500);
});

test('admin group history is empty for an unknown group or a group with no room yet', async t => {
    reset(t);
    t.mock.method(GroupChat, 'findById', () => chain(null));
    const missing = makeRes();
    await getGroupChatHistory({ body: { groupChatId: COMMUNITY_ID, currentPage: 0 } }, missing);
    assert.deepEqual(missing.body, { result: [], gotAllChats: true });

    const bad = makeRes();
    await getGroupChatHistory({ body: { groupChatId: 'not-an-id' } }, bad);
    assert.deepEqual(bad.body, { result: [], gotAllChats: true });
    assert.equal(rc.calls.length, 0);
});

test('an unreachable Rocket.Chat during the room lookup is reported, not shown as an empty chat', async t => {
    reset(t);
    rc.lookupFails = true;
    t.mock.method(GroupChat, 'findById', () => chain(community({ rcChannelId: null })));
    const history = makeRes();
    await getGroupChatHistory({ body: { groupChatId: COMMUNITY_ID, currentPage: 0 } }, history);
    assert.equal(history.statusCode, 500);

    t.mock.method(GroupChat, 'findOne', () => chain(community({ rcChannelId: null })));
    t.mock.method(MeetingThread, 'find', () => chain([]));
    const activity = makeRes();
    await getGroupChatActivity({ body: { groupChatId: COMMUNITY_ID } }, activity);
    assert.equal(activity.body.messagesAvailable, false);
    assert.equal(activity.body.totals.messages, null);
});

test('a recurring seminar is counted across every session of its series', async t => {
    reset(t);
    const SESSION_2 = '507f1f77bcf86cd799439098';
    const LATE = { _id: '507f1f77bcf86cd799439013', username: 'Late', email: 'late@x.com', role: 'customer' };
    const first = community({ type: 'seminar', seriesId: 'series-1', createdAt: new Date('2026-09-01T00:00:00.000Z') });
    const second = community({ _id: SESSION_2, type: 'seminar', seriesId: 'series-1', participants: [OWNER, LATE], createdAt: new Date('2026-09-08T00:00:00.000Z') });
    let findOneFilter: any = null;
    let seriesFilter: any = null;
    let meetingFilter: any = null;
    t.mock.method(GroupChat, 'findOne', (filter: any) => { findOneFilter = filter; return chain(second); });
    t.mock.method(GroupChat, 'find', (filter: any) => { seriesFilter = filter; return chain([first, second]); });
    t.mock.method(MeetingThread, 'find', (filter: any) => {
        meetingFilter = filter;
        return chain([{ startedBy: OWNER._id, joinEvents: [{ userId: STUDENT._id }] }, { startedBy: OWNER._id, joinEvents: [{ userId: LATE._id }] }]);
    });
    rc.history = [{ _id: 'x', msg: 'hi', u: { username: slug(LATE.email) } }];
    const res = makeRes();
    await getGroupChatActivity({ body: { groupChatId: SESSION_2 } }, res);

    assert.deepEqual(findOneFilter.type, { $in: ['community', 'seminar', 'individual'] });
    assert.deepEqual(seriesFilter, { seriesId: 'series-1', type: 'seminar' });
    assert.deepEqual(meetingFilter.groupChatId.$in.map(String), [COMMUNITY_ID, SESSION_2]);
    assert.deepEqual(res.body.members.map((m: any) => m.username), ['Owner', 'Sam', 'Late']);
    assert.equal(res.body.totals.calls, 2);
    assert.equal(res.body.totals.messagesFromOthers, 0, 'a student from another session is still a member');
    assert.equal(res.body.community.type, 'seminar');
    assert.equal(res.body.totals.since, '2026-09-01T00:00:00.000Z');
});

test('a one-off seminar uses only its own calls', async t => {
    reset(t);
    let meetingFilter: any = null;
    t.mock.method(GroupChat, 'findOne', () => chain(community({ type: 'seminar', seriesId: null })));
    t.mock.method(GroupChat, 'find', () => { throw new Error('no series lookup expected'); });
    t.mock.method(MeetingThread, 'find', (filter: any) => { meetingFilter = filter; return chain([]); });
    const res = makeRes();
    await getGroupChatActivity({ body: { groupChatId: COMMUNITY_ID } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(meetingFilter.groupChatId.$in.map(String), [COMMUNITY_ID]);
});

test('a 1:1 appointment reports call time against booked time and activity after it', async t => {
    reset(t);
    let findOneFilter: any = null;
    const appt = community({
        type: 'individual',
        seriesId: null,
        participants: [STUDENT],
        start: new Date('2026-10-01T15:00:00.000Z'),
        end: new Date('2026-10-01T15:30:00.000Z'),
        duration: 30,
    });
    t.mock.method(GroupChat, 'findOne', (filter: any) => { findOneFilter = filter; return chain(appt); });
    t.mock.method(MeetingThread, 'find', () => chain([
        { startedBy: OWNER._id, joinEvents: [{ userId: STUDENT._id }], status: 'ended', startedAt: new Date('2026-10-01T15:01:00.000Z'), duration: 29 * 60 },
        { startedBy: OWNER._id, joinEvents: [], status: 'ended', startedAt: new Date('2026-10-02T10:00:00.000Z'), duration: 600 },
    ]));
    rc.history = [
        { _id: 'a', msg: 'see you', ts: '2026-10-01T15:10:00.000Z', u: { username: slug(STUDENT.email) } },
        { _id: 'b', msg: 'one more question', ts: '2026-10-01T18:00:00.000Z', u: { username: slug(STUDENT.email) } },
    ];
    const res = makeRes();
    await getGroupChatActivity({ body: { groupChatId: COMMUNITY_ID } }, res);
    assert.ok(findOneFilter.type.$in.includes('individual'));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.appointment, {
        bookedMinutes: 30,
        calledMinutes: 29,
        timeStatus: 'recorded',
        callsDuring: 1,
        callsAfter: 1,
        messagesAfter: 1,
        scheduledEnd: '2026-10-01T15:30:00.000Z',
    });
    assert.deepEqual(res.body.members.map((m: any) => m.username), ['Owner', 'Sam']);
});

test('communities and seminars carry no appointment summary', async t => {
    reset(t);
    t.mock.method(GroupChat, 'findOne', () => chain(community()));
    t.mock.method(MeetingThread, 'find', () => chain([]));
    const res = makeRes();
    await getGroupChatActivity({ body: { groupChatId: COMMUNITY_ID } }, res);
    assert.equal(res.body.appointment, null);
});

