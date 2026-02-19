const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/requireAuth');
const {
    createZoomMeetingForGroupChat,
    createZoomMeetingForEvent,
    getZoomMeeting,
    getZoomSDKSignature,
    deleteZoomMeeting,
} = require('../controllers/zoom.controller');

// All routes require authentication
router.use(requireAuth(false));

router.post('/create-for-group-chat', createZoomMeetingForGroupChat);
router.post('/create-for-event', createZoomMeetingForEvent);
router.get('/meeting/:meetingId', getZoomMeeting);
router.post('/sdk-signature', getZoomSDKSignature);
router.delete('/meeting', deleteZoomMeeting);

module.exports = router;

