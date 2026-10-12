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

test('a new expert starts with rate and session lengths pending', async () => {
  const expert = new User({ email: 'new-expert@example.com', role: 'expert' });
  await runPreSave(expert);
  assert.deepEqual([...expert.pendingSetupSteps], ['rate', 'durations']);
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
