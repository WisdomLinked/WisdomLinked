import test from 'node:test';
import assert from 'node:assert/strict';

const auth = require('../middlewares/requireAuth');
const originalGetFullUserData = auth.getFullUserData;
auth.getFullUserData = async () => ({ _id: 'u1', password: 'x', token: 'y' });
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

const saveSettings = async (t: any, body: Record<string, unknown>) => {
  const calls: any[] = [];
  t.mock.method(User, 'findOneAndUpdate', async (_filter: unknown, update: unknown) => {
    calls.push(update);
    return {};
  });
  const res = makeRes();
  await controller.updateProfile({ user: { email: 'student@example.com' }, body }, res);
  return { res, set: calls[0]?.$set };
};

const allPrefs = (email: unknown) => ({
  notificationPreferences: { email, push: true, seminarReminders: true, sessionReminders: true, marketing: false },
});

test('switching email notifications off is stored', async t => {
  const { res, set } = await saveSettings(t, allPrefs(false));
  assert.equal(res.statusCode, 200);
  assert.equal(set['notificationPreferences.email'], false);
});

test('switching email notifications on is stored', async t => {
  const { set } = await saveSettings(t, allPrefs(true));
  assert.equal(set['notificationPreferences.email'], true);
});

test('the Settings page save (time zone + all switches) stores the email switch alongside the time zone', async t => {
  const { set } = await saveSettings(t, { timeZone: 'America/Chicago', ...allPrefs(false) });
  assert.equal(set.timeZone, 'America/Chicago');
  assert.equal(set['notificationPreferences.email'], false);
});

test('a multipart save, where the preferences arrive as a JSON string, stores it too', async t => {
  const { set } = await saveSettings(t, { notificationPreferences: JSON.stringify({ email: false }) });
  assert.equal(set['notificationPreferences.email'], false);
});

test('only a real boolean is stored: strings, numbers and operator objects are ignored', async t => {
  for (const email of ['false', 0, null, { $ne: true }, ['false']]) {
    const { set } = await saveSettings(t, allPrefs(email));
    assert.equal('notificationPreferences.email' in set, false, `stored ${JSON.stringify(email)}`);
  }
});

test('a profile save that does not mention preferences leaves the email switch alone', async t => {
  const { set } = await saveSettings(t, { username: 'Alice' });
  assert.equal('notificationPreferences.email' in set, false);
  assert.equal(set.username, 'Alice');
});

test('scope: the other four switches are still not stored (left for later on purpose)', async t => {
  const { set } = await saveSettings(t, allPrefs(false));
  for (const key of ['push', 'seminarReminders', 'sessionReminders', 'marketing']) {
    assert.equal(`notificationPreferences.${key}` in set, false, key);
  }
});

test('the operator-key guard still holds for everything else', async t => {
  const { set } = await saveSettings(t, { ...allPrefs(false), title: 'T' });
  for (const key of Object.keys(set)) {
    assert.equal(key.startsWith('$'), false, key);
    if (key.includes('.')) assert.equal(key, 'notificationPreferences.email');
  }
});
