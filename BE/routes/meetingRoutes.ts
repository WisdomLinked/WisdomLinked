const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/requireAuth');

import {
    startMeeting,
    endMeeting,
    addTranscriptMessage,
    getMeetingThread,
} from '../controllers/meeting.controller';

router.post('/start', requireAuth(false), startMeeting);
router.post('/end', requireAuth(false), endMeeting);
router.post('/transcript', requireAuth(false), addTranscriptMessage);
router.get('/:meetingThreadId', requireAuth(false), getMeetingThread);

module.exports = router;
