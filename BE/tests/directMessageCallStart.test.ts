import test from 'node:test';
import assert from 'node:assert/strict';

import { startMeeting } from '../controllers/meeting.controller';
import { MEETING_STUDENT_CANNOT_START_DM_CALL } from '../utils/meetingUserFacingCopy';
import { canStartDirectMessageCall } from '../utils/directCallRules';

const MeetingThread = require('../models/MeetingThread');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

const ME = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PEER = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const CONVERSATION = 'cccccccccccccccccccccccc';

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

const startDmCall = async (role: string, activeMeeting: any = null) => {
    const original = {
        userFindById: User.findById,
        conversationFindById: Conversation.findById,
        meetingFindOne: MeetingThread.findOne,
        meetingFind: MeetingThread.find,
        meetingSave: MeetingThread.prototype.save,
    };
    let created = false;
    try {
        process.env.JITSI_APP_ID = process.env.JITSI_APP_ID || 'wisdomlinked';
        process.env.JITSI_APP_SECRET = process.env.JITSI_APP_SECRET || 'test-secret-for-jwt';
        User.findById = () => ({
            select: async () => ({ _id: ME, email: 'me@test.com', username: 'Me', role, image: '' }),
        });
        const conversation = { _id: CONVERSATION, participants: [ME, PEER] };
        Conversation.findById = () => ({
            select: () => ({ lean: async () => conversation }),
            then: (resolve: any, reject: any) => Promise.resolve(conversation).then(resolve, reject),
        });
        MeetingThread.findOne = () => ({ sort: () => ({ select: async () => activeMeeting }) });
        MeetingThread.find = async () => [];
        MeetingThread.prototype.save = async function () {
            created = true;
            throw new Error('stop before Rocket.Chat');
        };
        const res = createRes();
        await startMeeting({ user: { userId: ME }, body: { conversationId: CONVERSATION } }, res);
        return { res, created };
    } finally {
        User.findById = original.userFindById;
        Conversation.findById = original.conversationFindById;
        MeetingThread.findOne = original.meetingFindOne;
        MeetingThread.find = original.meetingFind;
        MeetingThread.prototype.save = original.meetingSave;
    }
};

const liveMeeting = () => ({
    _id: 'meeting-live',
    status: 'active',
    jitsiRoomName: 'wl-room-dm',
    conversationId: CONVERSATION,
    groupChatId: undefined,
    startedAt: new Date(),
    startedBy: PEER,
    participants: [PEER],
    joinEvents: [],
    removedParticipants: [],
    delegatedModerators: [],
    save: async () => undefined,
});

test('a student cannot start a call in a direct message', async () => {
    const { res, created } = await startDmCall('customer');
    assert.equal(res.statusCode, 409);
    assert.equal(res.body?.error, MEETING_STUDENT_CANNOT_START_DM_CALL);
    assert.equal(created, false, 'no meeting is created');
});

test('the refusal is a 409 like other not-allowed answers, never a 401/403', async () => {
    const { res } = await startDmCall('customer');
    assert.notEqual(res.statusCode, 401);
    assert.notEqual(res.statusCode, 403);
});

test('a student can still join a call the other person already started', async () => {
    const meeting = liveMeeting();
    const { res, created } = await startDmCall('customer', meeting);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.joinedExisting, true);
    assert.equal(String(res.body?.meetingThreadId), 'meeting-live');
    assert.ok(res.body?.jitsiUrl);
    assert.equal(created, false, 'joining never creates a second meeting');
    assert.ok(meeting.participants.some((p: any) => String(p) === ME));
});

for (const [article, role] of [['an', 'expert'], ['an', 'admin']]) {
    test(`${article} ${role} can still start a call in a direct message`, async () => {
        const { res, created } = await startDmCall(role);
        assert.notEqual(res.statusCode, 409);
        assert.equal(created, true, 'it reaches meeting creation');
    });
}

test('canStartDirectMessageCall: only students are refused', () => {
    assert.equal(canStartDirectMessageCall('customer'), false);
    assert.equal(canStartDirectMessageCall('Customer'), false);
    assert.equal(canStartDirectMessageCall('expert'), true);
    assert.equal(canStartDirectMessageCall('admin'), true);
});
