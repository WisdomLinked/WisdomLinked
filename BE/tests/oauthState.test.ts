import test from 'node:test';
import assert from 'node:assert/strict';

const { parseOAuthState, blocksNewUserWithoutRegisterRole } = require('../utils/oauthState');

test('parseOAuthState reads JSON state from WeChat/Google', () => {
  const encoded = encodeURIComponent(
    JSON.stringify({ role: 'customer', redirect: '/foo', timezone: 'America/Chicago' }),
  );
  const parsed = parseOAuthState(encoded);
  assert.equal(parsed.role, 'customer');
  assert.equal(parsed.redirectPath, '/foo');
  assert.equal(parsed.timezone, 'America/Chicago');
});

test('parseOAuthState accepts already-decoded JSON', () => {
  const parsed = parseOAuthState('{"role":"expert","redirect":"","timezone":"UTC"}');
  assert.equal(parsed.role, 'expert');
});

test('parseOAuthState treats login role from login-page OAuth', () => {
  const parsed = parseOAuthState(
    encodeURIComponent(JSON.stringify({ role: 'login', redirect: '', timezone: 'UTC' })),
  );
  assert.equal(parsed.role, 'login');
});

test('blocksNewUserWithoutRegisterRole blocks Google login signup but not WeChat', () => {
  assert.equal(blocksNewUserWithoutRegisterRole(true, 'login', 'google'), true);
  assert.equal(blocksNewUserWithoutRegisterRole(true, null, 'google'), true);
  assert.equal(blocksNewUserWithoutRegisterRole(true, 'customer', 'google'), false);
  assert.equal(blocksNewUserWithoutRegisterRole(true, 'login', 'wechat'), false);
  assert.equal(blocksNewUserWithoutRegisterRole(false, 'login', 'google'), false);
});
