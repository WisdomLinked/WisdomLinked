import test from 'node:test';
import assert from 'node:assert/strict';

const auth = require('../middlewares/requireAuth');
const originalGetFullUserData = auth.getFullUserData;
auth.getFullUserData = async () => ({ _id: 'e1', password: 'x', token: 'y' });
const controller = require('../controllers/auth.controller');
auth.getFullUserData = originalGetFullUserData;
const User = require('../models/User');

const makeRes = () => ({
  statusCode: 200, body: null as any,
  status(code: number) { this.statusCode = code; return this; },
  send(body: any) { this.body = body; return this; },
  json(body: any) { this.body = body; return this; },
  cookie() { return this; },
});

const runPreSave = (doc: any) =>
  new Promise<void>((resolve, reject) =>
    User.schema.s.hooks.execPre('save', doc, [], (err: unknown) => (err ? reject(err) : resolve())),
  );

const updateWith = async (t: any, body: Record<string, unknown>) => {
  const calls: any[] = [];
  t.mock.method(User, 'findOneAndUpdate', async (_filter: unknown, update: unknown) => {
    calls.push(update);
    return {};
  });
  const res = makeRes();
  await controller.updateProfile({ user: { email: 'expert@example.com' }, body }, res);
  return { res, update: calls[0] };
};

test('a new expert starts with rate, session lengths and booking notice pending', async () => {
  const expert = new User({ email: 'new-expert@example.com', role: 'expert' });
  await runPreSave(expert);
  assert.deepEqual([...expert.pendingSetupSteps], ['rate', 'durations', 'notice']);
});

test('a new expert has no hourly rate saved', async () => {
  const expert = new User({ email: 'new-expert@example.com', role: 'expert' });
  await runPreSave(expert);
  assert.deepEqual([...expert.price], []);
});

test('new students and existing experts get no pending setup steps', async () => {
  const student = new User({ email: 'student@example.com', role: 'customer' });
  await runPreSave(student);
  assert.equal(student.pendingSetupSteps, undefined);

  const existing = new User({ email: 'old-expert@example.com', role: 'expert' });
  existing.isNew = false;
  await runPreSave(existing);
  assert.equal(existing.pendingSetupSteps, undefined);
});

test('saving a rate or session lengths clears those pending steps', async t => {
  const { res, update } = await updateWith(t, { price: 50, appointmentDurations: [30, 60] });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(update.$pull, { pendingSetupSteps: { $in: ['rate', 'durations'] } });
  assert.equal(update.$set.price, 50);
});

test('profile saves without rate or session lengths leave pending steps alone', async t => {
  const { update } = await updateWith(t, { title: 'Engineer', bufferMinutes: 15 });
  assert.equal(update.$pull, undefined);
});

test('a new pending registration carries no hourly rate', () => {
  const PendingUser = require('../models/PendingUser');
  const pending = new PendingUser({ email: 'pending-expert@example.com', role: 'expert' });
  assert.deepEqual([...pending.price], []);
});

const expertController = require('../controllers/expert.controller');

test('saving a booking notice clears the pending notice step', async t => {
  const calls: any[] = [];
  t.mock.method(User, 'findByIdAndUpdate', (_filter: unknown, update: unknown) => {
    calls.push(update);
    return { select: async () => ({ bookingNoticeHours: 48, timeZone: 'UTC' }) };
  });
  const res = makeRes();
  await expertController.setBookingNoticeHours({ user: { userId: 'e1' }, body: { bookingNoticeHours: 48 } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls[0], { $set: { bookingNoticeHours: 48 }, $pull: { pendingSetupSteps: 'notice' } });
});

test('an invalid booking notice is refused without touching pending steps', async t => {
  const calls: any[] = [];
  t.mock.method(User, 'findByIdAndUpdate', (_filter: unknown, update: unknown) => {
    calls.push(update);
    return { select: async () => ({}) };
  });
  const res = makeRes();
  await expertController.setBookingNoticeHours({ user: { userId: 'e1' }, body: { bookingNoticeHours: 12 } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

const chooseRole = async (t: any, role: string, stored: Record<string, unknown> = {}) => {
  const user: any = { email: 'social@example.com', oauthProvider: 'google', status: 'review', keywords: [], role: 'customer', ...stored };
  user.save = async () => user;
  t.mock.method(User, 'findOne', async () => user);
  const res = makeRes();
  await controller.setOAuthRole({ user: { email: 'social@example.com' }, body: { role } }, res);
  return { res, user };
};

test('a social sign-up who chooses expert starts with the same pending steps as any new expert', async t => {
  const { res, user } = await chooseRole(t, 'expert');
  assert.equal(res.statusCode, 200);
  assert.equal(user.role, 'expert');
  assert.deepEqual(user.pendingSetupSteps, ['rate', 'durations', 'notice']);
});

test('a social sign-up who chooses student gets no pending steps', async t => {
  const { user } = await chooseRole(t, 'customer');
  assert.equal(user.role, 'customer');
  assert.equal(user.pendingSetupSteps, undefined);
});

test('choosing expert keeps pending steps that are already set', async t => {
  const { user } = await chooseRole(t, 'expert', { pendingSetupSteps: ['rate'] });
  assert.deepEqual(user.pendingSetupSteps, ['rate']);
});
