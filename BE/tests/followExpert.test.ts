import test from 'node:test';
import assert from 'node:assert/strict';

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    status(code: number) {
        this.statusCode = code;
        return this;
    },
    send(payload: any) {
        this.body = payload;
        return this;
    },
    json(payload: any) {
        this.body = payload;
        return this;
    },
});

test('followExpert links both sides and returns the updated count', async () => {
    const User = require('../models/User');
    const controller = require('../controllers/customer.controller');

    const originalFindOne = User.findOne;
    const originalFindById = User.findById;
    const originalUpdateOne = User.updateOne;

    const updates: any[] = [];

    try {
        User.findOne = async () => ({ _id: 'expert-1', role: 'expert' });
        User.updateOne = async (filter: any, update: any) => {
            updates.push({ filter, update });
            return { acknowledged: true };
        };
        User.findById = () => ({
            select: async () => ({ followers: ['student-1'] }),
        });

        const req: any = { user: { userId: 'student-1' }, params: { expertId: 'expert-1' } };
        const res = makeRes();

        await controller.followExpert(req, res);

        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { following: true, followerCount: 1 });
        assert.equal(updates.length, 2);
        assert.deepEqual(updates[0].update, { $addToSet: { following: 'expert-1' } });
        assert.deepEqual(updates[1].update, { $addToSet: { followers: 'student-1' } });
    } finally {
        User.findOne = originalFindOne;
        User.findById = originalFindById;
        User.updateOne = originalUpdateOne;
    }
});

test('followExpert rejects following yourself', async () => {
    const controller = require('../controllers/customer.controller');

    const req: any = { user: { userId: 'me-1' }, params: { expertId: 'me-1' } };
    const res = makeRes();

    await controller.followExpert(req, res);

    assert.equal(res.statusCode, 400);
});

test('followExpert returns 404 when the expert does not exist', async () => {
    const User = require('../models/User');
    const controller = require('../controllers/customer.controller');

    const originalFindOne = User.findOne;
    try {
        User.findOne = async () => null;
        const req: any = { user: { userId: 'student-1' }, params: { expertId: 'ghost' } };
        const res = makeRes();

        await controller.followExpert(req, res);

        assert.equal(res.statusCode, 404);
    } finally {
        User.findOne = originalFindOne;
    }
});

test('unfollowExpert pulls both sides and returns the updated count', async () => {
    const User = require('../models/User');
    const controller = require('../controllers/customer.controller');

    const originalFindById = User.findById;
    const originalUpdateOne = User.updateOne;

    const updates: any[] = [];

    try {
        User.updateOne = async (filter: any, update: any) => {
            updates.push({ filter, update });
            return { acknowledged: true };
        };
        User.findById = () => ({
            select: async () => ({ followers: [] }),
        });

        const req: any = { user: { userId: 'student-1' }, params: { expertId: 'expert-1' } };
        const res = makeRes();

        await controller.unfollowExpert(req, res);

        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { following: false, followerCount: 0 });
        assert.equal(updates.length, 2);
        assert.deepEqual(updates[0].update, { $pull: { following: 'expert-1' } });
        assert.deepEqual(updates[1].update, { $pull: { followers: 'student-1' } });
    } finally {
        User.findById = originalFindById;
        User.updateOne = originalUpdateOne;
    }
});
