import test from 'node:test';
import assert from 'node:assert/strict';
const controller = require('../controllers/groupChat.controller');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');

async function candidates(t: any, type: string, viewer: string, missing = false) {
  const group = { type, admin: { _id: 'host' }, participants: ['host', 'member'], coModerators: ['moderator'] };
  t.mock.method(GroupChat, 'findById', async () => missing ? null : group);
  let query: any;
  let fields: string | undefined;
  t.mock.method(User, 'find', (q: any) => {
    query = q;
    const chain = { select: (s: string) => { fields = s; return chain; }, sort: () => chain, lean: async () => [{ _id: 'expert' }, { _id: 'student' }] };
    return chain;
  });
  const res: any = { code: 200, body: null, status(n: number) { this.code = n; return this; }, send(b: any) { this.body = b; return this; }, json(b: any) { this.body = b; return this; } };
  await controller.getGroupMemberCandidates({ params: { groupChatId: 'group' }, user: { userId: viewer } }, res);
  return { res, query, fields };
}

for (const type of ['seminar', 'community']) {
  test(`${type} host can list students and experts with only picker profile fields`, async t => {
    const { res, query, fields } = await candidates(t, type, 'host');
    assert.equal(res.code, 200);
    assert.deepEqual(query.role, { $in: ['customer', 'expert'] });
    assert.deepEqual(query.status, { $ne: 'blocked' });
    assert.deepEqual(new Set(query._id.$nin), new Set(['host', 'member', 'moderator']));
    assert.equal(fields, '_id username email image role');
    assert.equal(res.body.result.length, 2);
  });
  test(`${type} ordinary members cannot browse invitation candidates`, async t => {
    const { res, query } = await candidates(t, type, 'member');
    assert.equal(res.code, 403);
    assert.equal(query, undefined);
  });
}

test('community co-moderators can list candidates', async t => {
  assert.equal((await candidates(t, 'community', 'moderator')).res.code, 200);
});
test('seminar invite permission remains host-only', async t => {
  assert.equal((await candidates(t, 'seminar', 'moderator')).res.code, 403);
});
test('missing groups and individual sessions have no member picker', async t => {
  assert.equal((await candidates(t, 'individual', 'host')).res.code, 404);
});
test('missing groups do not query users', async t => {
  const { res, query } = await candidates(t, 'community', 'host', true);
  assert.equal(res.code, 404);
  assert.equal(query, undefined);
});
