const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/requireAuth');

import {
    startMeeting,
    endMeeting,
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
router.post('/transcript', requireAuth(false), addTranscriptMessage);
router.post('/chat-sync', requireAuth(false), syncMeetingChatMessage);
router.post('/rate', requireAuth(false), submitMeetingRating);
router.post('/guest-invite', requireAuth(false), createMeetingGuestInvite);
router.post('/revoke-participant', requireAuth(false), revokeMeetingParticipant);
router.post('/delegate-moderator', requireAuth(false), delegateMeetingModerator);
router.post('/revoke-delegate-moderator', requireAuth(false), revokeDelegatedMeetingModerator);
router.get('/guest-invite/:token', resolveMeetingGuestInvite);
router.get('/guest-invite/:token/join', requireAuth(false), joinMeetingFromGuestInvite);
router.get('/:meetingThreadId/join', requireAuth(false), getMeetingJoinInfo);
router.get('/:meetingThreadId/rating-state', requireAuth(false), getMeetingRatingState);
router.get('/:meetingThreadId', requireAuth(false), getMeetingThread);

module.exports = router;
