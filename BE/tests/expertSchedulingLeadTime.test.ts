import test from 'node:test';
import assert from 'node:assert/strict';

const auth = require('../middlewares/requireAuth');
const originalGetFullUserData = auth.getFullUserData;
auth.getFullUserData = async () => ({ _id: 'host' });
const controller = require('../controllers/groupChat.controller');
auth.getFullUserData = originalGetFullUserData;
const GroupChat = require('../models/GroupChat');
const Event = require('../models/Event');
const User = require('../models/User');
const AppState = require('../models/AppState');
const { SCHEDULED_START_IN_PAST } = require('../utils/bookingLeadTime');

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const NOTICE = /hours in advance/;
const REACHED_WRITE = 'reached-write';

const makeRes = () => ({
  statusCode: 200, body: null as any,
  status(code: number) { this.statusCode = code; return this; },
  send(body: any) { this.body = body; return this; },
  json(body: any) { this.body = body; return this; },
});

const expert = () => ({
  _id: 'host', email: 'host@example.com', username: 'host', bookingNoticeHours: 72,
  price: [25], bufferMinutes: 0, timeSlots: [18],
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

test('an expert can publish a seminar inside their own booking notice', async t => {
  const { res, writes } = await createSeminar(t, { status: 'active', start: inHours(2), end: inHours(3) });
  assert.doesNotMatch(String(res.body), NOTICE);
  assert.deepEqual(writes, ['create']);
});

test('an expert can publish a recurring seminar whose first session is inside their notice', async t => {
  const { res, writes } = await createSeminar(t, {
    status: 'active', start: inHours(2), end: inHours(3),
    isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 1, recurrenceCount: 5,
  });
  assert.doesNotMatch(String(res.body), NOTICE);
  assert.deepEqual(writes, ['insertMany']);
});

test('publishing a seminar that starts in the past is refused before anything is written', async t => {
  const { res, writes } = await createSeminar(t, { status: 'active', start: inHours(-2), end: inHours(-1) });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body, SCHEDULED_START_IN_PAST);
  assert.deepEqual(writes, []);
});

test('a recurring seminar whose first session is in the past is refused before any occurrence is written', async t => {
  const { res, writes } = await createSeminar(t, {
    status: 'active', start: inHours(-2), end: inHours(-1),
    isRecurring: true, recurrenceUnit: 'day', recurrenceInterval: 1, recurrenceCount: 5,
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body, SCHEDULED_START_IN_PAST);
  assert.deepEqual(writes, []);
});

test('a draft can still be saved with any date', async t => {
  const { res, writes } = await createSeminar(t, { status: 'draft', start: inHours(-2), end: inHours(-1) });
  assert.notEqual(res.body, SCHEDULED_START_IN_PAST);
  assert.deepEqual(writes, ['create']);
});

test('a 1:1 created through the group route inside the notice reaches creation', async t => {
  const { res, writes } = await createSeminar(t, {
    type: 'individual', status: 'pending', customerId: 'student', start: inHours(2), end: inHours(3),
  });
  assert.doesNotMatch(String(res.body), NOTICE);
  assert.deepEqual(writes, ['create']);
});

test('a 1:1 created through the group route in the past is refused', async t => {
  const { res, writes } = await createSeminar(t, {
    type: 'individual', status: 'pending', customerId: 'student', start: inHours(-2), end: inHours(-1),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body, SCHEDULED_START_IN_PAST);
  assert.deepEqual(writes, []);
});

const propose = async (t: any, start: string) => {
  t.mock.method(User, 'findById', async () => expert());
  t.mock.method(User, 'findOne', async () => ({ _id: 'student', email: 'student@example.com', groupChats: [], save: async () => {} }));
  t.mock.method(Event, 'find', () => ({ select: async () => [] }));
  t.mock.method(GroupChat, 'find', () => ({ select: async () => [] }));
  t.mock.method(AppState, 'findOne', async () => null);
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

test('an expert can propose a 1:1 inside their own booking notice', async t => {
  const { res, writes } = await propose(t, inHours(2));
  assert.doesNotMatch(String(res.body), NOTICE);
  assert.deepEqual(writes, ['create']);
});

test('proposing a 1:1 in the past is refused', async t => {
  const { res, writes } = await propose(t, inHours(-2));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body, SCHEDULED_START_IN_PAST);
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

test('publishing a draft that starts inside the notice works', async t => {
  const { res, writes } = await update(t, { status: 'draft', start: inHours(2), end: inHours(3) }, { status: 'active' });
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].status, 'active');
});

test('publishing a draft while moving it inside the notice works', async t => {
  const { res, writes } = await update(t, { status: 'draft', start: inHours(100), end: inHours(101) }, {
    status: 'active', start: inHours(2), end: inHours(3),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
});

test('publishing a draft whose start has already passed is refused', async t => {
  const { res, writes } = await update(t, { status: 'draft', start: inHours(-1), end: inHours(1) }, { status: 'active' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body, SCHEDULED_START_IN_PAST);
  assert.deepEqual(writes, []);
});

test('publishing a draft while moving it into the past is refused', async t => {
  const { res, writes } = await update(t, { status: 'draft', start: inHours(100), end: inHours(101) }, {
    status: 'active', start: inHours(-2), end: inHours(-1),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body, SCHEDULED_START_IN_PAST);
  assert.deepEqual(writes, []);
});

test('saving a draft inside the notice still works', async t => {
  const { res, writes } = await update(t, { status: 'draft', start: inHours(100), end: inHours(101) }, {
    status: 'draft', start: inHours(2), end: inHours(3),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
});

test('editing an already-live seminar that is now inside the notice still works', async t => {
  const { res, writes } = await update(t, { status: 'active', start: inHours(2), end: inHours(3) }, {
    status: 'active', description: 'Updated details',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].description, 'Updated details');
});
