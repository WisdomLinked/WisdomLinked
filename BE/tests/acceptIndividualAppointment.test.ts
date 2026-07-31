import test from 'node:test';
import assert from 'node:assert/strict';

const notificationsPath = require.resolve('../services/notifications');
const groupChatPath = require.resolve('../controllers/groupChat.controller');

test('acceptIndividualAppointment returns 200 when notifications fail after save', async () => {
    const GroupChat = require('../models/GroupChat');
    const User = require('../models/User');
    const PaymentHistory = require('../models/PaymentHistory');

    const originalFindOne = GroupChat.findOne;
    const originalFindOneAndUpdate = GroupChat.findOneAndUpdate;
    const originalFindById = User.findById;
    const originalHistoryExists = PaymentHistory.exists;
    const originalNotifications = require('../services/notifications');

    const savedGroup = {
        _id: 'gc-accept-1',
        name: '1:1 Session',
        start: new Date(Date.now() + 48 * 60 * 60 * 1000),
        end: new Date(Date.now() + 49 * 60 * 60 * 1000),
        duration: 60,
        price: 50,
        admin: 'expert-1',
        createdBy: 'student-1',
        status: 'pending',
        save: async function save() {
            this.status = 'active';
            return this;
        },
    };

    try {
        GroupChat.findOne = async () => savedGroup;
        GroupChat.findOneAndUpdate = async () => savedGroup;
        PaymentHistory.exists = async () => null;
        User.findById = async (id: string) => {
            if (String(id) === 'expert-1') {
                return {
                    _id: 'expert-1',
                    email: 'expert@test.com',
                    username: 'Expert',
                    timeZone: 'UTC',
                };
            }
            if (String(id) === 'student-1') {
                return {
                    _id: 'student-1',
                    email: 'student@test.com',
                    username: 'Student',
                    timeZone: 'UTC',
                };
            }
            return null;
        };

        require.cache[notificationsPath] = {
            id: notificationsPath,
            filename: notificationsPath,
            loaded: true,
            exports: {
                ...originalNotifications,
                sendEmailMeetingAcceptance: async () => {
                    throw new Error('SendGrid unavailable');
                },
                scheduleEmailReminder: async () => {
                    throw new Error('SendGrid unavailable');
                },
            },
        };
        delete require.cache[groupChatPath];
        const groupController = require('../controllers/groupChat.controller');

        const req: any = {
            user: { userId: 'expert-1', role: 'expert' },
            body: { groupChatId: 'gc-accept-1' },
        };
        const res: any = {
            statusCode: 200,
            body: null,
            status(code: number) {
                this.statusCode = code;
                return this;
            },
            send(payload: any) {
                this.body = payload;
                return this;
            },
        };

        await groupController.acceptIndividualAppointment(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(savedGroup.status, 'active');
        assert.match(String(res.body), /accepted successfully/i);
    } finally {
        GroupChat.findOne = originalFindOne;
        GroupChat.findOneAndUpdate = originalFindOneAndUpdate;
        PaymentHistory.exists = originalHistoryExists;
        User.findById = originalFindById;
        require.cache[notificationsPath] = {
            id: notificationsPath,
            filename: notificationsPath,
            loaded: true,
            exports: originalNotifications,
        };
        delete require.cache[groupChatPath];
    }
});
