const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/requireAuth');
const { apiLimiter } = require('../middlewares/rateLimit');
router.use(apiLimiter);

import { meetingChatSyncGate } from '../middlewares/meetingChatSyncGate';
import {
    startMeeting,
    endMeeting,
    endMeetingFromCall,
    meetingHeartbeat,
    getMeetingPermissions,
    addTranscriptMessage,
    syncMeetingChatMessage,
    getMeetingThread,
    getMeetingRatingState,
    submitMeetingRating,
    createMeetingGuestInvite,
    resolveMeetingGuestInvite,
    joinMeetingFromGuestInvite,
    getMeetingJoinInfo,
    revokeMeetingParticipant,
    delegateMeetingModerator,
    revokeDelegatedMeetingModerator,
} from '../controllers/meeting.controller';

router.post('/start', requireAuth(false), startMeeting);
router.post('/end', requireAuth(false), endMeeting);
router.post('/end-call', meetingChatSyncGate, endMeetingFromCall);
router.post('/heartbeat', meetingChatSyncGate, meetingHeartbeat);
router.get('/permissions', meetingChatSyncGate, getMeetingPermissions);
router.post('/transcript', requireAuth(false), addTranscriptMessage);
router.post('/chat-sync', meetingChatSyncGate, syncMeetingChatMessage);
router.post('/rate', requireAuth(false), submitMeetingRating);
router.post('/guest-invite', requireAuth(false), createMeetingGuestInvite);
router.post('/revoke-participant', requireAuth(false), revokeMeetingParticipant);
router.post('/delegate-moderator', meetingChatSyncGate, delegateMeetingModerator);
router.post('/revoke-delegate-moderator', meetingChatSyncGate, revokeDelegatedMeetingModerator);
router.get('/guest-invite/:token', resolveMeetingGuestInvite);
router.get('/guest-invite/:token/join', requireAuth(false), joinMeetingFromGuestInvite);
router.get('/:meetingThreadId/join', requireAuth(false), getMeetingJoinInfo);
router.get('/:meetingThreadId/rating-state', requireAuth(false), getMeetingRatingState);
router.get('/:meetingThreadId', requireAuth(false), getMeetingThread);

module.exports = router;
