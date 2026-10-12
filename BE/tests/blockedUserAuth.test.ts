import test from 'node:test';
import assert from 'node:assert/strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, customerAuth, expertAuth, adminAuth } = require('../middlewares/requireAuth');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const makeRes = () => ({
  statusCode: 200, body: null as any,
  status(code: number) { this.statusCode = code; return this; },
  send(body: any) { this.body = body; return this; },
  json(body: any) { this.body = body; return this; },
  cookie() { return this; },
});

const stubUser = (t: any, fields: Record<string, unknown>) => {
  const user = { _id: 'u1', token: 'server-token', email: 'u@test.com', ...fields };
  t.mock.method(User, 'findOne', () => ({ select: async () => user }));
};

const run = async (middleware: any) => {
  const token = jwt.sign({ email: 'u@test.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const res = makeRes();
  let nextCalled = false;
  await middleware({ headers: {}, cookies: { accessToken: token } }, res, () => { nextCalled = true; });
  return { res, nextCalled };
};

const blockedBody = {
  status: 'FAIL',
  error: 'Your profile is blocked. Contact admin for more details.',
  code: 'USER_BLOCKED',
};

for (const [name, middleware, role] of [
  ['requireAuth', requireAuth(false), 'customer'],
  ['requireAuth(restrictUnderReview)', requireAuth(true), 'customer'],
  ['customerAuth', customerAuth(true), 'customer'],
  ['expertAuth', expertAuth(true), 'expert'],
] as const) {
  test(`${name} answers a blocked user with the USER_BLOCKED code`, async t => {
    stubUser(t, { role, status: 'blocked' });
    const { res, nextCalled } = await run(middleware);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, blockedBody);
  });
}

test('an under-review user still gets UNDER_REVIEW, not USER_BLOCKED', async t => {
  stubUser(t, { role: 'customer', status: 'review' });
  const { res } = await run(customerAuth(true));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'UNDER_REVIEW');
});

test('adminAuth keeps its existing response for a blocked admin', async t => {
  stubUser(t, { role: 'admin', status: 'blocked' });
  const { res, nextCalled } = await run(adminAuth);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(typeof res.body, 'string');
});
