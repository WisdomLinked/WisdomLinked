import test from 'node:test';
import assert from 'node:assert/strict';
const auth = require('../middlewares/requireAuth');
auth.getFullUserData = async () => ({ _id: 'host' });
const rocket = require('../services/rocketchat.service');
const synced: any[] = [];
require.cache[require.resolve('../services/rocketchat.service')]!.exports = {
  ...rocket,
  syncRocketGroupChannelMembers: async (...args: any[]) => { synced.push(args); return null; },
};
const controller = require('../controllers/groupChat.controller');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');

for (const viewer of ['host', 'moderator', 'outsider']) {
  test(`${viewer} adding an expert preserves community permissions and syncs membership`, async t => {
    synced.length = 0;
    let saves = 0;
    const group = { _id: 'community', type: 'community', admin: 'host', coModerators: ['moderator'], participants: ['host'], save: async () => { saves++; } };
    t.mock.method(GroupChat, 'findOne', async () => group);
    t.mock.method(User, 'find', () => ({ select: async () => [{ _id: 'expert-2' }, { _id: 'student' }] }));
    t.mock.method(User, 'findById', async () => ({ email: 'host@example.com' }));
    t.mock.method(GroupChat, 'findById', () => {
      const chain = { populate: () => chain, then: (resolve: any) => Promise.resolve({
        ...group, participants: group.participants.map(id => ({ email: `${id}@example.com` })), admin: { email: 'host@example.com' },
      }).then(resolve) };
      return chain;
    });
    const res: any = { code: 200, body: null, status(n: number) { this.code = n; return this; }, json(b: any) { this.body = b; return this; } };
    await controller.addParticipantsToCommunityChat({ user: { userId: viewer }, body: { communityChatId: 'community', participantIds: ['expert-2', 'student'] } }, res);
    if (viewer === 'outsider') {
      assert.equal(res.code, 403);
      assert.equal(saves, 0);
      assert.equal(synced.length, 0);
    } else {
      assert.equal(res.code, 200);
      assert.deepEqual(group.participants, ['host', 'expert-2', 'student']);
      assert.equal(saves, 1);
      assert(synced[0][1].includes('expert-2@example.com'));
    }
    assert.equal(group.admin, 'host');
    assert.deepEqual(group.coModerators, ['moderator']);
  });
}
