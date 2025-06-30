const express = require("express");
const router = express.Router();
const { customerAuth } = require("../middlewares/requireAuth");
const {
    filterExperts,
    filterSeminars,
    getExpertById,
} = require('../controllers/customer.controller')
const {
    appendEvent,
    updateEvent,
    cancelEvent,
    createFeedback,
} = require('../controllers/event.controller')
const {
    cancelPendingSeminar,
    cancelIndividualAppointment,
    leftSeminar
} = require('../controllers/groupChat.controller')

router.post("/filterExperts", customerAuth(false), filterExperts);
router.get("/getUser/:id",customerAuth(false),getExpertById)
router.post("/filterSeminars", customerAuth(false), filterSeminars);
router.post("/appendEvent", customerAuth(true), appendEvent);
router.post("/updateEvent", customerAuth(true), updateEvent);
router.post("/cancelEvent", customerAuth(false), cancelEvent);
router.post("/cancelIndividualAppointment", customerAuth(false), cancelIndividualAppointment);
router.post("/cancelPendingSeminar", customerAuth(false), cancelPendingSeminar);
router.post("/leftSeminar", customerAuth(false), leftSeminar);
router.post("/createEventFeedback", customerAuth(true), createFeedback);
module.exports = router;
