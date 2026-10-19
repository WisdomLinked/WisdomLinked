import test from 'node:test';
import assert from 'node:assert/strict';

const groupController = require('../controllers/groupChat.controller');
const eventController = require('../controllers/event.controller');
const GroupChat = require('../models/GroupChat');
const Event = require('../models/Event');
const User = require('../models/User');

const makeRes = () => ({
  statusCode: 200, body: null as any,
  status(code: number) { this.statusCode = code; return this; },
  send(body: any) { this.body = body; return this; },
  json(body: any) { this.body = body; return this; },
});

const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();

const setUpExpert = (overrides: Record<string, unknown> = {}) => ({
  _id: 'host', email: 'host@example.com', username: 'host',
  price: [25], bufferMinutes: 0, bookingNoticeHours: 24, timeSlots: [18],
  groupChats: [], save: async () => {},
  ...overrides,
});

const propose = async (t: any, expert: any) => {
  t.mock.method(User, 'findById', async () => expert);
  t.mock.method(User, 'findOne', async () => ({ _id: 'student', email: 'student@example.com', role: 'customer', groupChats: [], save: async () => {} }));
  const created = t.mock.method(GroupChat, 'create', async () => { throw new Error('reached-create'); });
  const res = makeRes();
  await groupController.proposeIndividualAppointment({
    user: { userId: 'host' },
    body: {
      name: 'Proposal to a student', start: inDays(5), end: inDays(5.05),
      duration: 60, price: 0, customer: 'student@example.com', overrideAvailability: true,
    },
  }, res);
  return { res, created };
};

test('an expert who has not finished profile setup cannot propose a session', async t => {
  const { res, created } = await propose(t, setUpExpert({ pendingSetupSteps: ['rate'] }));
  assert.equal(res.statusCode, 409);
  assert.match(String(res.body), /You need to complete your profile setup first/);
  assert.equal(created.mock.callCount(), 0);
});

test('a fully set-up expert gets past the setup check when proposing', async t => {
  const { res } = await propose(t, setUpExpert());
  assert.notEqual(res.statusCode, 409);
  assert.doesNotMatch(String(res.body), /complete.*profile setup/);
});

test('an expert cannot propose a session to an admin', async t => {
  const expert = setUpExpert();
  t.mock.method(User, 'findById', async () => expert);
  t.mock.method(User, 'findOne', async () => ({ _id: 'adm', email: 'admin@example.com', role: 'admin', groupChats: [], save: async () => {} }));
  const created = t.mock.method(GroupChat, 'create', async () => { throw new Error('reached-create'); });
  const res = makeRes();
  await groupController.proposeIndividualAppointment({
    user: { userId: 'host' },
    body: {
      name: 'Proposal to an admin', start: inDays(5), end: inDays(5.05),
      duration: 60, price: 0, customer: 'admin@example.com', overrideAvailability: true,
    },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(String(res.body), /only propose a session to a student/);
  assert.equal(created.mock.callCount(), 0);
});

const acceptEvent = async (t: any, user: any) => {
  t.mock.method(Event, 'findById', async () => ({ _id: 'ev1', end: inDays(3), customer: 'c1', expert: 'host' }));
  const updated = t.mock.method(Event, 'findByIdAndUpdate', async () => { throw new Error('reached-update'); });
  const res = makeRes();
  await eventController.acceptEvent({ user, body: { eventId: 'ev1' } }, res);
  return { res, updated };
};

test('an expert who has not finished profile setup cannot accept from the Calendar', async t => {
  const { res, updated } = await acceptEvent(t, { userId: 'host', role: 'expert', ...setUpExpert({ bufferMinutes: undefined }) });
  assert.equal(res.statusCode, 409);
  assert.match(String(res.body), /You need to complete your profile setup first/);
  assert.equal(updated.mock.callCount(), 0);
});

test('a fully set-up expert gets past the setup check when accepting from the Calendar', async t => {
  const { updated } = await acceptEvent(t, { userId: 'host', role: 'expert', ...setUpExpert() });
  assert.equal(updated.mock.callCount(), 1);
});

const createSeminar = async (t: any, expert: any, status: 'active' | 'draft') => {
  t.mock.method(User, 'findById', async () => expert);
  const create = t.mock.method(GroupChat, 'create', async () => { throw new Error('reached-create'); });
  const insertMany = t.mock.method(GroupChat, 'insertMany', async () => { throw new Error('reached-create'); });
  const res = makeRes();
  await groupController.createGroupChat({
    user: { userId: 'host', email: 'host@example.com' },
    body: { name: 'Seminar setup gate', type: 'seminar', status, start: inDays(5), end: inDays(5.05), duration: 60, price: 0 },
  }, res);
  return { res, writes: create.mock.callCount() + insertMany.mock.callCount() };
};

for (const status of ['active', 'draft'] as const) {
  test(`an expert who has not finished profile setup cannot create a seminar (${status})`, async t => {
    const { res, writes } = await createSeminar(t, setUpExpert({ timeSlots: [] }), status);
    assert.equal(res.statusCode, 409);
    assert.match(String(res.body), /You need to complete your profile setup first/);
    assert.equal(writes, 0);
  });

  test(`a fully set-up expert gets past the setup check when creating a seminar (${status})`, async t => {
    const { res, writes } = await createSeminar(t, setUpExpert(), status);
    assert.notEqual(res.statusCode, 409);
    assert.equal(writes, 1);
  });
}
