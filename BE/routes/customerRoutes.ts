const express = require("express");
const router = express.Router();
const { customerAuth } = require("../middlewares/requireAuth");
const { apiLimiter, sensitiveLimiter } = require("../middlewares/rateLimit");
const {
    filterExperts,
    filterSeminars,
    getExpertById,
    followExpert,
    unfollowExpert,
    getMyPaymentHistory,
} = require('../controllers/customer.controller')
const {
    appendEvent,
    updateEvent,
    cancelEvent,
    createFeedback,
} = require('../controllers/event.controller')
const {
    leftSeminar
} = require('../controllers/groupChat.controller')

// Baseline rate limiting for every customer route below.
router.use(apiLimiter);

router.post("/filterExperts", customerAuth(false), filterExperts);
router.get("/getUser/:id",customerAuth(false),getExpertById)
router.post("/filterSeminars", customerAuth(false), filterSeminars);
router.post("/appendEvent", customerAuth(true), appendEvent);
router.post("/updateEvent", customerAuth(true), updateEvent);
router.post("/cancelEvent", customerAuth(false), cancelEvent);
router.post("/leftSeminar", customerAuth(false), leftSeminar);
router.post("/createEventFeedback", customerAuth(true), createFeedback);
router.post("/follow/:expertId", customerAuth(false), followExpert);
router.post("/unfollow/:expertId", customerAuth(false), unfollowExpert);
router.post("/getMyPaymentHistory", customerAuth(false), sensitiveLimiter, getMyPaymentHistory);
module.exports = router;
