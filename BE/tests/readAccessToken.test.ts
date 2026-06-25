import test from 'node:test';
import assert from 'node:assert/strict';

const { readAccessToken } = require('../middlewares/requireAuth');

test('readAccessToken prefers cookie over Authorization header', () => {
  const req = {
    cookies: { accessToken: 'from-cookie' },
    headers: { authorization: 'Bearer from-header' },
  };
  assert.equal(readAccessToken(req), 'from-cookie');
});

test('readAccessToken falls back to Bearer token when cookie missing', () => {
  const req = {
    cookies: {},
    headers: { authorization: 'Bearer from-header' },
  };
  assert.equal(readAccessToken(req), 'from-header');
});

test('readAccessToken returns null when no credentials', () => {
  assert.equal(readAccessToken({ cookies: {}, headers: {} }), null);
});
