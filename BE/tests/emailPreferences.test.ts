import test from 'node:test';
import assert from 'node:assert/strict';
import { wantsEmail, bookingEmailTo, NOTIFICATION_PREFERENCE_KEYS } from '../utils/emailPreferences';

const user = (notificationPreferences?: Record<string, unknown>) => ({
  email: 'someone@example.com',
  ...(notificationPreferences === undefined ? {} : { notificationPreferences }),
});

test('a user with no preferences recorded gets every email', () => {
  assert.equal(wantsEmail(user(), 'bookings'), true);
  assert.equal(wantsEmail(user({}), 'bookings'), true);
  assert.equal(wantsEmail(user({}), 'seminarReminders'), true);
  assert.equal(wantsEmail(user({}), 'sessionReminders'), true);
});

test('a missing user is treated as opted in', () => {
  assert.equal(wantsEmail(null, 'bookings'), true);
  assert.equal(wantsEmail(undefined, 'sessionReminders'), true);
});

test('switching one option off silences only that option', () => {
  const u = user({ email: true, bookings: false, seminarReminders: true, sessionReminders: true });
  assert.equal(wantsEmail(u, 'bookings'), false);
  assert.equal(wantsEmail(u, 'seminarReminders'), true);
  assert.equal(wantsEmail(u, 'sessionReminders'), true);
});

test('the master switch silences every option, even ones left on', () => {
  const u = user({ email: false, bookings: true, seminarReminders: true, sessionReminders: true });
  assert.equal(wantsEmail(u, 'bookings'), false);
  assert.equal(wantsEmail(u, 'seminarReminders'), false);
  assert.equal(wantsEmail(u, 'sessionReminders'), false);
});

test('only an explicit false switches an email off', () => {
  for (const value of [undefined, null, 'false', 0, true]) {
    assert.equal(wantsEmail(user({ bookings: value }), 'bookings'), true, String(value));
    assert.equal(wantsEmail(user({ email: value }), 'bookings'), true, String(value));
  }
});

test('bookingEmailTo gives the address only when booking emails are wanted', () => {
  assert.equal(bookingEmailTo(user({ bookings: true })), 'someone@example.com');
  assert.equal(bookingEmailTo(user()), 'someone@example.com');
  assert.equal(bookingEmailTo(user({ bookings: false })), '');
  assert.equal(bookingEmailTo(user({ email: false })), '');
});

test('bookingEmailTo is empty when there is no one to email', () => {
  assert.equal(bookingEmailTo(null), '');
  assert.equal(bookingEmailTo({}), '');
  assert.equal(bookingEmailTo({ email: '' }), '');
});

test('reminder opt-outs do not silence booking emails', () => {
  assert.equal(bookingEmailTo(user({ seminarReminders: false, sessionReminders: false })), 'someone@example.com');
});

test('every option the Settings pages send is a storable key', () => {
  for (const key of ['email', 'bookings', 'seminarReminders', 'sessionReminders', 'marketing', 'push']) {
    assert.ok(NOTIFICATION_PREFERENCE_KEYS.includes(key), key);
  }
  assert.equal(NOTIFICATION_PREFERENCE_KEYS.length, 6);
});
