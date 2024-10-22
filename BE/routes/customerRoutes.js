const express = require("express");
const router = express.Router();
const { customerAuth } = require("../middlewares/requireAuth");
const {
    filterExperts,
    filterSeminars,
} = require('../controllers/customer.controller')
const {
    appendEvent,
    updateEvent,
    cancelEvent,
} = require('../controllers/event.controller')
const {
    cancelPendingSeminar,
    leftSeminar
} = require('../controllers/groupChat.controller')

router.post("/filterExperts", customerAuth(false), filterExperts);
router.post("/filterSeminars", customerAuth(false), filterSeminars);
router.post("/appendEvent", customerAuth(true), appendEvent);
router.post("/updateEvent", customerAuth(true), updateEvent);
router.post("/cancelEvent", customerAuth(false), cancelEvent);
router.post("/cancelPendingSeminar", customerAuth(false), cancelPendingSeminar);
router.post("/leftSeminar", customerAuth(false), leftSeminar);

module.exports = router;
