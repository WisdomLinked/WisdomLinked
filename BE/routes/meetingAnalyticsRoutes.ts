const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/requireAuth");
const meetingAnalyticsController = require("../controllers/meetingAnalytics.controller");
const { apiLimiter, sensitiveLimiter } = require("../middlewares/rateLimit");

// Baseline rate limiting for every meeting-analytics route below.
router.use(apiLimiter);

// create a new MeetingAnalytics record
router.post("/create", sensitiveLimiter, requireAuth(), meetingAnalyticsController.createMeetingAnalytics);

// update an existing MeetingAnalytics record (add feedback, update times, etc.)
router.post("/update", sensitiveLimiter, requireAuth(), meetingAnalyticsController.updateMeetingAnalytics);

// get meeting analytics by referenceId (eventId or groupChatId)
router.post("/get", requireAuth(), meetingAnalyticsController.getMeetingAnalytics);

module.exports = router;
