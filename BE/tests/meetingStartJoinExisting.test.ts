import test from 'node:test';
import assert from 'node:assert/strict';

import { startMeeting } from '../controllers/meeting.controller';
import { MEETING_WAITING_FOR_HOST } from '../utils/meetingUserFacingCopy';

const MeetingThread = require('../models/MeetingThread');
const GroupChat = require('../models/GroupChat');
const User = require('../models/User');

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
    };
    return res;
};

const adminId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const memberId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const occA = 'cccccccccccccccccccccccc';
const occB = 'dddddddddddddddddddddddd';
const seriesId = 'eeeeeeeeeeeeeeeeeeeeeeee';

test('startMeeting: non-admin waits when no active group meet', async () => {
    const originalUserFind = User.findById;
    const originalGroupFindById = GroupChat.findById;
    const originalMeetingFindOne = MeetingThread.findOne;
    const originalScopeFind = GroupChat.find;

    try {
        User.findById = () => ({
            select: async () => ({
                _id: memberId,
                email: 'member@test.com',
                username: 'Member',
                role: 'customer',
            }),
        });

        const groupDoc = {
            _id: occA,
            seriesId,
            type: 'seminar',
            admin: { _id: adminId, email: 'admin@test.com', role: 'expert' },
            participants: [{ _id: memberId, email: 'member@test.com', role: 'customer' }],
        };
        GroupChat.findById = () => ({
            populate() {
                return this;
            },
            then(resolve: any) {
                resolve(groupDoc);
            },
        });
        GroupChat.find = () => ({
            select: () => ({
                lean: async () => [{ _id: occA }, { _id: occB }],
            }),
        });
        MeetingThread.findOne = () => ({
            sort: () => ({
                select: async () => null,
            }),
        });

        const req: any = {
            user: { userId: memberId },
            body: { groupChatId: occA },
        };
        const res = createRes();
        await startMeeting(req, res);

        assert.equal(res.statusCode, 403);
        assert.equal(res.body?.error, MEETING_WAITING_FOR_HOST);
    } finally {
        User.findById = originalUserFind;
        GroupChat.findById = originalGroupFindById;
        MeetingThread.findOne = originalMeetingFindOne;
        GroupChat.find = originalScopeFind;
    }
});

test('startMeeting: non-admin joins active meet on sibling series occurrence', async () => {
    const originalUserFind = User.findById;
    const originalGroupFindById = GroupChat.findById;
    const originalMeetingFindOne = MeetingThread.findOne;
    const originalScopeFind = GroupChat.find;

    const activeMeeting: any = {
        _id: 'meeting-live',
        status: 'active',
        jitsiRoomName: 'wl-room-1',
        groupChatId: occA,
        conversationId: undefined,
        startedAt: new Date(),
        startedBy: adminId,
        participants: [adminId],
        joinEvents: [],
        removedParticipants: [],
        delegatedModerators: [],
        save: async () => undefined,
    };

    try {
        process.env.JITSI_APP_ID = process.env.JITSI_APP_ID || 'wisdomlinked';
        process.env.JITSI_APP_SECRET = process.env.JITSI_APP_SECRET || 'test-secret-for-jwt';

        User.findById = () => ({
            select: async () => ({
                _id: memberId,
                email: 'member@test.com',
                username: 'Member',
                role: 'customer',
                image: '',
            }),
        });

        const groupDoc = {
            _id: occB,
            seriesId,
            type: 'seminar',
            admin: { _id: adminId, email: 'admin@test.com', role: 'expert' },
            participants: [{ _id: memberId, email: 'member@test.com', role: 'customer' }],
        };
        GroupChat.findById = () => ({
            populate() {
                return this;
            },
            select() {
                return {
                    lean: async () => ({
                        _id: occA,
                        seriesId,
                        admin: adminId,
                        participants: [memberId, adminId],
                        coModerators: [],
                    }),
                };
            },
            then(resolve: any) {
                resolve(groupDoc);
            },
        });
        GroupChat.find = () => ({
            select: () => ({
                lean: async () => [
                    { _id: occA, admin: adminId, participants: [memberId, adminId], coModerators: [] },
                    { _id: occB, admin: adminId, participants: [memberId, adminId], coModerators: [] },
                ],
            }),
        });
        MeetingThread.findOne = () => ({
            sort: () => ({
                select: async () => activeMeeting,
            }),
        });

        const req: any = {
            user: { userId: memberId },
            body: { groupChatId: occB },
        };
        const res = createRes();
        await startMeeting(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body?.joinedExisting, true);
        assert.equal(String(res.body?.meetingThreadId), 'meeting-live');
        assert.ok(res.body?.jitsiUrl);
        assert.equal(res.body?.message, undefined);
        assert.ok(activeMeeting.participants.some((p: any) => String(p) === memberId));
        assert.ok(
            activeMeeting.joinEvents.some(
                (e: any) => String(e.userId) === memberId && e.source === 'start-join',
            ),
        );
    } finally {
        User.findById = originalUserFind;
        GroupChat.findById = originalGroupFindById;
        MeetingThread.findOne = originalMeetingFindOne;
        GroupChat.find = originalScopeFind;
    }
});
