import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getActiveAnnouncement,
    setAnnouncement,
    toPublicAnnouncement,
} from '../controllers/announcement.controller';

const AppState = require('../models/AppState');
const AdminAuditLog = require('../models/AdminAuditLog');

const originalAuditCreate = AdminAuditLog.create;
AdminAuditLog.create = async () => ({});

const createRes = () => {
    const res: any = {
        statusCode: 200,
        body: null,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(payload: any) {
            this.body = payload;
            return this;
        },
        send(payload: any) {
            this.body = payload;
            return this;
        },
    };
    return res;
};

test('toPublicAnnouncement returns null when inactive or empty', () => {
    assert.equal(toPublicAnnouncement(null), null);
    assert.equal(toPublicAnnouncement({ id: 'a1', message: 'Hi', active: false }), null);
    assert.equal(toPublicAnnouncement({ id: '', message: 'Hi', active: true }), null);
    assert.equal(toPublicAnnouncement({ id: 'a1', message: '  ', active: true }), null);
});

test('toPublicAnnouncement returns the public payload when active', () => {
    assert.deepEqual(
        toPublicAnnouncement({
            id: 'a1',
            message: '  New mentor joined  ',
            link: '/experts',
            linkLabel: 'Meet them',
            active: true,
        }),
        {
            id: 'a1',
            message: 'New mentor joined',
            link: '/experts',
            linkLabel: 'Meet them',
            active: true,
        },
    );
});

test('GET active returns the public announcement or null', async () => {
    const originalFindOne = AppState.findOne;
    try {
        AppState.findOne = () => ({
            select: () => ({
                lean: async () => ({
                    announcement: { id: 'a1', message: 'Hello', link: '', linkLabel: '', active: true },
                }),
            }),
        });
        const res = createRes();
        await getActiveAnnouncement({} as any, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, {
            id: 'a1',
            message: 'Hello',
            link: '',
            linkLabel: '',
            active: true,
        });

        AppState.findOne = () => ({
            select: () => ({
                lean: async () => ({ announcement: { id: 'a1', message: 'Hello', active: false } }),
            }),
        });
        const inactive = createRes();
        await getActiveAnnouncement({} as any, inactive);
        assert.equal(inactive.body, null);
    } finally {
        AppState.findOne = originalFindOne;
    }
});

test('POST publish mints a new id and deactivate keeps GET null', async () => {
    const originalFindOne = AppState.findOne;
    const originalCreate = AppState.create;
    const state = {
        announcement: { id: 'old-id', message: 'Old', link: '', linkLabel: '', active: false },
        async save() {},
    };

    try {
        AppState.findOne = async () => state;
        AppState.create = async () => state;

        const publish = createRes();
        await setAnnouncement(
            { body: { message: 'New seminar this Friday', link: '/seminars', active: true }, user: { email: 'admin@x.com' } } as any,
            publish,
        );
        assert.equal(publish.body.result, 'SUCCESS');
        assert.equal(publish.body.announcement.active, true);
        assert.equal(publish.body.announcement.message, 'New seminar this Friday');
        assert.ok(publish.body.announcement.id);
        assert.notEqual(publish.body.announcement.id, 'old-id');
        const publishedId = publish.body.announcement.id;

        const deactivate = createRes();
        await setAnnouncement(
            { body: { active: false }, user: { email: 'admin@x.com' } } as any,
            deactivate,
        );
        assert.equal(deactivate.body.result, 'SUCCESS');
        assert.equal(deactivate.body.announcement.active, false);
        assert.equal(deactivate.body.announcement.id, publishedId);

        AppState.findOne = () => ({
            select: () => ({
                lean: async () => ({ announcement: state.announcement }),
            }),
        });
        const active = createRes();
        await getActiveAnnouncement({} as any, active);
        assert.equal(active.body, null);
    } finally {
        AppState.findOne = originalFindOne;
        AppState.create = originalCreate;
    }
});

test('POST publish without a message is rejected', async () => {
    const originalFindOne = AppState.findOne;
    try {
        AppState.findOne = async () => ({ announcement: {} });
        const res = createRes();
        await setAnnouncement({ body: { active: true, message: '  ' } } as any, res);
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Announcement message is required.');
    } finally {
        AppState.findOne = originalFindOne;
    }
});
