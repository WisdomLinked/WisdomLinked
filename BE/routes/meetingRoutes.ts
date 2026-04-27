const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/requireAuth');

import {
    startMeeting,
    endMeeting,
    addTranscriptMessage,
    getMeetingThread,
    getMeetingRatingState,
    submitMeetingRating,
    createMeetingGuestInvite,
    resolveMeetingGuestInvite,
    getMeetingJoinInfo,
    revokeMeetingParticipant,
} from '../controllers/meeting.controller';

router.post('/start', requireAuth(false), startMeeting);
router.post('/end', requireAuth(false), endMeeting);
router.post('/transcript', requireAuth(false), addTranscriptMessage);
router.post('/rate', requireAuth(false), submitMeetingRating);
router.post('/guest-invite', requireAuth(false), createMeetingGuestInvite);
router.post('/revoke-participant', requireAuth(false), revokeMeetingParticipant);
router.get('/guest-invite/:token', resolveMeetingGuestInvite);
router.get('/:meetingThreadId/join', requireAuth(false), getMeetingJoinInfo);
router.get('/:meetingThreadId/rating-state', requireAuth(false), getMeetingRatingState);
router.get('/:meetingThreadId', requireAuth(false), getMeetingThread);

module.exports = router;
