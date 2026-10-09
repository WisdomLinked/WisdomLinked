import test from 'node:test';
import assert from 'node:assert/strict';

const auth = require('../middlewares/requireAuth');
const originalGetFullUserData = auth.getFullUserData;
auth.getFullUserData = async () => ({ _id: 'host' });
const controller = require('../controllers/groupChat.controller');
auth.getFullUserData = originalGetFullUserData;
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const NOTICE = /must be scheduled at least 48 hours in advance, as per your minimum booking notice/;
const REACHED_WRITE = 'reached-write';

const makeRes = () => ({
  statusCode: 200, body: null as any,
  status(code: number) { this.statusCode = code; return this; },
  send(body: any) { this.body = body; return this; },
  json(body: any) { this.body = body; return this; },
});

const expert = () => ({
  _id: 'host', email: 'host@example.com', username: 'host', bookingNoticeHours: 48,
  groupChats: [], save: async () => {},
});

function mockWrites(t: any) {
  const writes: string[] = [];
  t.mock.method(GroupChat, 'create', async () => { writes.push('create'); throw new Error(REACHED_WRITE); });
  t.mock.method(GroupChat, 'insertMany', async () => { writes.push('insertMany'); throw new Error(REACHED_WRITE); });
  return writes;
}

const createSeminar = async (t: any, body: any) => {
  t.mock.method(User, 'findById', async () => expert());
  const writes = mockWrites(t);
  const res = makeRes();
  await controller.createGroupChat({
    user: { userId: 'host', email: 'host@example.com' },
    body: { name: 'Lead time seminar', type: 'seminar', duration: 60, price: 0, ...body },
  }, res);
  return { res, writes };
};

test('publishing a seminar inside the notice is refused with the notice in the message', async t => {
  const { res, writes } = await createSeminar(t, { status: 'active', start: inHours(10), end: inHours(11) });
  assert.equal(res.statusCode, 400);
  assert.match(res.body, /^Seminars /);
  assert.match(res.body, NOTICE);
  assert.deepEqual(writes, []);
});

test('a recurring seminar whose first session is inside the notice is refused before any occurrence is written', async t => {
  const { res, writes } = await createSeminar(t, {
    status: 'active', start: inHours(10), end: inHours(11),
    isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 1, recurrenceCount: 5,
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.body, NOTICE);
  assert.deepEqual(writes, []);
});

test('a seminar outside the notice still reaches creation', async t => {
  const { res, writes } = await createSeminar(t, { status: 'active', start: inHours(49), end: inHours(50) });
  assert.doesNotMatch(String(res.body), NOTICE);
  assert.deepEqual(writes, ['create']);
});

test('a draft inside the notice can still be saved', async t => {
  const { res, writes } = await createSeminar(t, { status: 'draft', start: inHours(10), end: inHours(11) });
  assert.doesNotMatch(String(res.body), NOTICE);
  assert.deepEqual(writes, ['create']);
});

test('a 1:1 created through the group route is held to the notice too', async t => {
  const { res, writes } = await createSeminar(t, {
    type: 'individual', status: 'pending', customerId: 'student', start: inHours(10), end: inHours(11),
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.body, /^1:1 sessions /);
  assert.deepEqual(writes, []);
});

const propose = async (t: any, start: string) => {
  t.mock.method(User, 'findById', async () => expert());
  t.mock.method(User, 'findOne', async () => ({ _id: 'student', email: 'student@example.com', groupChats: [], save: async () => {} }));
  const writes = mockWrites(t);
  const res = makeRes();
  await controller.proposeIndividualAppointment({
    user: { userId: 'host' },
    body: {
      name: 'Proposal inside the notice', start, end: new Date(new Date(start).getTime() + 3600_000).toISOString(),
      duration: 60, price: 0, customer: 'student@example.com', overrideAvailability: true,
    },
  }, res);
  return { res, writes };
};

test('proposing a 1:1 inside the notice is refused with the notice in the message', async t => {
  const { res, writes } = await propose(t, inHours(10));
  assert.equal(res.statusCode, 400);
  assert.match(res.body, /^1:1 sessions /);
  assert.match(res.body, NOTICE);
  assert.deepEqual(writes, []);
});

test('proposing a 1:1 in the past is refused the same way', async t => {
  const { res, writes } = await propose(t, inHours(-2));
  assert.equal(res.statusCode, 400);
  assert.match(res.body, NOTICE);
  assert.deepEqual(writes, []);
});

async function update(t: any, stored: any, body: any) {
  let doc: any = {
    _id: 'seminar-1', type: 'seminar', admin: 'host', participants: ['host'],
    rcChannelId: 'existing-room', ...stored,
  };
  const writes: any[] = [];
  t.mock.method(User, 'findById', async () => expert());
  t.mock.method(GroupChat, 'findById', async () => doc);
  t.mock.method(GroupChat, 'find', async () => [doc]);
  t.mock.method(GroupChat, 'findByIdAndUpdate', async (_id: string, fields: any) => {
    writes.push(fields);
    doc = { ...doc, ...fields };
    return doc;
  });
  const res = makeRes();
  await controller.updateGroupChat({
    user: { userId: 'host', email: 'host@example.com' },
    body: { groupId: 'seminar-1', ...body },
  }, res);
  return { res, writes };
}

test('publishing a draft that starts inside the notice is refused', async t => {
  const { res, writes } = await update(t, { status: 'draft', start: inHours(10), end: inHours(11) }, { status: 'active' });
  assert.equal(res.statusCode, 400);
  assert.match(res.body, NOTICE);
  assert.deepEqual(writes, []);
});

test('publishing a draft while moving it inside the notice is refused', async t => {
  const { res, writes } = await update(t, { status: 'draft', start: inHours(100), end: inHours(101) }, {
    status: 'active', start: inHours(10), end: inHours(11),
  });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(writes, []);
});

test('publishing a draft that starts outside the notice still works', async t => {
  const { res, writes } = await update(t, { status: 'draft', start: inHours(100), end: inHours(101) }, { status: 'active' });
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].status, 'active');
});

test('saving a draft inside the notice still works', async t => {
  const { res, writes } = await update(t, { status: 'draft', start: inHours(100), end: inHours(101) }, {
    status: 'draft', start: inHours(10), end: inHours(11),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
});

test('editing an already-live seminar that is now inside the notice still works', async t => {
  const { res, writes } = await update(t, { status: 'active', start: inHours(10), end: inHours(11) }, {
    status: 'active', description: 'Updated details',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].description, 'Updated details');
});
