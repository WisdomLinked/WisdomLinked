import test from 'node:test';
import assert from 'node:assert/strict';

const auth = require('../middlewares/requireAuth');
const originalGetFullUserData = auth.getFullUserData;
auth.getFullUserData = async () => ({ _id: 'host' });
const controller = require('../controllers/groupChat.controller');
auth.getFullUserData = originalGetFullUserData;
const GroupChat = require('../models/GroupChat');

async function update(t: any, storedStatus: string | undefined, requestedStatus: string | undefined, extra: any = {}) {
  let doc = {
    _id: 'seminar-1', type: 'seminar', admin: 'host', participants: ['host'],
    status: storedStatus, rcChannelId: 'existing-room', ...extra,
  };
  const writes: any[] = [];
  t.mock.method(GroupChat, 'findById', async () => doc);
  t.mock.method(GroupChat, 'find', async () => [doc]);
  t.mock.method(GroupChat, 'findByIdAndUpdate', async (_id: string, fields: any) => {
    writes.push(fields);
    doc = { ...doc, ...fields };
    return doc;
  });
  const res: any = {
    statusCode: 200, body: null,
    status(code: number) { this.statusCode = code; return this; },
    send(body: any) { this.body = body; return this; },
    json(body: any) { this.body = body; return this; },
  };
  await controller.updateGroupChat({
    user: { userId: 'host', email: 'host@example.com' },
    body: { groupId: 'seminar-1', status: requestedStatus, description: 'Updated details' },
  }, res);
  return { res, writes, doc };
}

for (const extra of [{}, { participants: ['host', 'student'] }, { seriesId: 'series-1' }]) {
  test(`published seminar cannot become a draft: ${JSON.stringify(extra)}`, async t => {
    const { res, writes } = await update(t, 'active', 'draft', extra);
    assert.equal(res.statusCode, 409);
    assert.match(res.body, /cannot be saved as a draft/);
    assert.deepEqual(writes, []);
  });
}

test('published seminar cannot bypass the draft restriction by becoming pending', async t => {
  const { res, writes } = await update(t, 'active', 'pending');
  assert.equal(res.statusCode, 409);
  assert.deepEqual(writes, []);
});

for (const status of ['cancelled', undefined]) {
  test(`existing seminar with status ${status} cannot become a draft`, async t => {
    const { res, writes } = await update(t, status, 'draft');
    assert.equal(res.statusCode, 409);
    assert.deepEqual(writes, []);
  });
}

for (const [before, after] of [
  ['draft', 'draft'], ['pending', 'draft'], ['draft', 'active'], ['active', 'active'], ['active', undefined],
]) {
  test(`seminar still supports ${before} → ${after ?? 'details only'}`, async t => {
    const { res, writes, doc } = await update(t, before, after);
    assert.equal(res.statusCode, 200);
    assert.equal(writes.length, 1);
    assert.equal(doc.status, after ?? before);
    assert.equal(doc.description, 'Updated details');
  });
}

test('other group types retain their existing status behaviour', async t => {
  const { res, doc } = await update(t, 'active', 'pending', { type: 'individual' });
  assert.equal(res.statusCode, 200);
  assert.equal(doc.status, 'pending');
});
