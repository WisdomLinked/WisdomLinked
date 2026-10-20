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

const PREFERENCE_PATHS = [
  'notificationPreferences.email',
  'notificationPreferences.push',
  'notificationPreferences.bookings',
  'notificationPreferences.seminarReminders',
  'notificationPreferences.sessionReminders',
  'notificationPreferences.marketing',
];

test('the student/expert Settings save stores every switch, including Bookings and approvals', async t => {
  // Exactly what settingsModel.toProfileUpdate sends.
  const { set } = await saveSettings(t, {
    timeZone: 'America/Chicago',
    notificationPreferences: {
      email: true,
      bookings: false,
      seminarReminders: false,
      sessionReminders: true,
      marketing: false,
    },
  });
  assert.equal(set.timeZone, 'America/Chicago');
  assert.equal(set['notificationPreferences.email'], true);
  assert.equal(set['notificationPreferences.bookings'], false);
  assert.equal(set['notificationPreferences.seminarReminders'], false);
  assert.equal(set['notificationPreferences.sessionReminders'], true);
  assert.equal(set['notificationPreferences.marketing'], false);
});

test('switching a sub-option back on is stored', async t => {
  const { set } = await saveSettings(t, {
    notificationPreferences: { bookings: true, seminarReminders: true, sessionReminders: true },
  });
  assert.equal(set['notificationPreferences.bookings'], true);
  assert.equal(set['notificationPreferences.seminarReminders'], true);
  assert.equal(set['notificationPreferences.sessionReminders'], true);
});

test('the admin Settings save stores push and marketing too', async t => {
  const { set } = await saveSettings(t, {
    notificationPreferences: { email: true, push: false, marketing: true },
  });
  assert.equal(set['notificationPreferences.push'], false);
  assert.equal(set['notificationPreferences.marketing'], true);
});

test('a multipart save stores the sub-options as well', async t => {
  const { set } = await saveSettings(t, {
    notificationPreferences: JSON.stringify({ bookings: false, sessionReminders: false }),
  });
  assert.equal(set['notificationPreferences.bookings'], false);
  assert.equal(set['notificationPreferences.sessionReminders'], false);
});

test('a save that names only some switches leaves the others alone', async t => {
  const { set } = await saveSettings(t, { notificationPreferences: { seminarReminders: false } });
  assert.equal(set['notificationPreferences.seminarReminders'], false);
  for (const path of PREFERENCE_PATHS.filter(p => !p.endsWith('seminarReminders'))) {
    assert.equal(path in set, false, path);
  }
});

test('only a real boolean is stored, for every switch', async t => {
  for (const value of ['false', 0, null, { $ne: true }, ['false']]) {
    const prefs = Object.fromEntries(PREFERENCE_PATHS.map(p => [p.split('.')[1], value]));
    const { set } = await saveSettings(t, { notificationPreferences: prefs });
    for (const path of PREFERENCE_PATHS) {
      assert.equal(path in set, false, `${path} stored ${JSON.stringify(value)}`);
    }
  }
});

test('names that are not Settings switches are never stored', async t => {
  const { set } = await saveSettings(t, {
    notificationPreferences: JSON.parse('{"role":false,"$where":true,"email.x":false,"__proto__":{"email":false}}'),
  });
  for (const key of Object.keys(set)) {
    assert.equal(key.startsWith('notificationPreferences.'), false, key);
  }
});

test('the operator-key guard still holds for everything else', async t => {
  const { set } = await saveSettings(t, {
    ...allPrefs(false),
    title: 'T',
    'notificationPreferences.email': true,
    'role.x': 'admin',
    $set: { role: 'admin' },
  });
  for (const key of Object.keys(set)) {
    assert.equal(key.startsWith('$'), false, key);
    if (key.includes('.')) assert.ok(PREFERENCE_PATHS.includes(key), key);
  }
  assert.equal(set['notificationPreferences.email'], false);
});
