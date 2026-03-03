const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/requireAuth");
const meetingAnalyticsController = require("../controllers/meetingAnalytics.controller");

// create a new MeetingAnalytics record
router.post("/create", requireAuth(), meetingAnalyticsController.createMeetingAnalytics);

// update an existing MeetingAnalytics record (add feedback, update times, etc.)
router.post("/update", requireAuth(), meetingAnalyticsController.updateMeetingAnalytics);

// get meeting analytics by referenceId (eventId or groupChatId)
router.post("/get", requireAuth(), meetingAnalyticsController.getMeetingAnalytics);

module.exports = router;
