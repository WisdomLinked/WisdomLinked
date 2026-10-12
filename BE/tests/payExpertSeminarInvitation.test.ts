import test from 'node:test';
import assert from 'node:assert/strict';

const hostId = '111111111111111111111111';
const guestId = '222222222222222222222222';
const groupId = '333333333333333333333333';
const requestId = '444444444444444444444444';
let verifiedIntent: any;
const stripe = require('../controllers/stripe.controller');
stripe.checkPaymentIntentSucceeded = async () => verifiedIntent;
stripe.checkPaymentIntentProcessing = async () => false;
stripe.sendBookingReceiptAndConfirmation = async () => {};
const auth = require('../middlewares/requireAuth');
auth.getFullUserData = async () => ({ _id: guestId, role: 'expert' });
const rocketPath = require.resolve('../services/rocketchat.service');
const rocket = require(rocketPath);
require.cache[rocketPath]!.exports = { ...rocket, syncRocketGroupChannelMembers: async () => null };
const controller = require('../controllers/groupChat.controller');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');
const AppState = require('../models/AppState');
const SeatRequest = require('../models/SeminarSeatRequest');
const PaymentHistory = require('../models/PaymentHistory');

for (const scenario of ['expert accepts', 'different recipient', 'expired invitation', 'wrong payment owner']) {
  test(`paid expert invitation: ${scenario}`, async t => {
    const request = { _id: requestId, customer: guestId, groupChat: groupId, amount: 4900,
      status: 'awaiting_payment', origin: 'host', paymentDeadline: new Date(scenario === 'expired invitation' ? 0 : Date.now() + 86400000) };
    const group = { _id: groupId, type: 'seminar', name: 'Research', admin: hostId,
      participants: [hostId], status: 'active', start: new Date(Date.now() + 86400000) };
    verifiedIntent = { amount: 4900, currency: 'usd', metadata: { bookingType: 'groupChat', groupChatId: groupId,
      userId: scenario === 'wrong payment owner' ? hostId : guestId, seatRequestId: requestId } };
    let enrolled: any;
    let updatedUser: any;
    let charge: any;
    let claimed = false;
    t.mock.method(SeatRequest, 'findById', async () => request);
    t.mock.method(SeatRequest, 'findOneAndUpdate', async (filter: any, update: any) => {
      assert.equal(filter.status, 'awaiting_payment');
      assert.equal(update.$set.status, 'approved');
      claimed = true;
      return request;
    });
    t.mock.method(SeatRequest, 'updateOne', async () => ({}));
    t.mock.method(PaymentHistory, 'find', () => ({ select: async () => [] }));
    t.mock.method(PaymentHistory.prototype, 'save', async function(this: any) { charge = this.toObject(); return this; });
    t.mock.method(AppState, 'findOne', async () => ({ stripeMode: 'test' }));
    t.mock.method(GroupChat, 'findById', () => {
      const chain = { populate: () => chain, then: (resolve: any) => Promise.resolve(group).then(resolve) };
      return chain;
    });
    t.mock.method(GroupChat, 'updateMany', async (_filter: any, update: any) => { enrolled = update; });
    t.mock.method(User, 'findById', async (id: string) => ({ _id: id, role: 'expert', username: 'Expert', email: `${id}@example.com` }));
    t.mock.method(User, 'updateOne', async (filter: any, update: any) => { updatedUser = { filter, update }; });
    const res: any = { code: 200, body: null, status(n: number) { this.code = n; return this; },
      send(b: any) { this.body = b; return this; }, json(b: any) { this.body = b; return this; } };
    await controller.paySeminarSeatRequest({ user: { userId: scenario === 'different recipient' ? hostId : guestId },
      body: { requestId, payment_intent: 'pi_expert' } }, res);
    if (scenario === 'expert accepts') {
      assert.equal(res.code, 200);
      assert.equal(res.body.status, 'approved');
      assert.equal(res.body.result.role, 'expert');
      assert.equal(claimed, true);
      assert.deepEqual(enrolled, { $addToSet: { participants: guestId } });
      assert.equal(updatedUser.filter._id, guestId);
      assert.deepEqual(updatedUser.update, { $addToSet: { groupChats: { $each: [groupId] } } });
      assert.equal(String(charge.customer), guestId);
      assert.equal(String(charge.expert), hostId);
      assert.equal(charge.amount, 4900);
      assert.equal(charge.status, 'completed');
    } else {
      assert.equal(res.code, scenario === 'different recipient' ? 404 : scenario === 'expired invitation' ? 410 : 400);
      assert.equal(claimed, false);
      assert.equal(enrolled, undefined);
      assert.equal(charge, undefined);
    }
  });
}
