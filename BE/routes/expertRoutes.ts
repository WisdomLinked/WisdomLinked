const express = require("express");
const router = express.Router();
const { expertAuth, requireAuth } = require("../middlewares/requireAuth");
const {
    updateTimeSlots,
    getDailyTimeSlots,
    updateDailyTimeSlots,
    filterCustomers,
    getCustomerById,
    shareMeetingViaEmail,
    getMyPaymentHistory,
} = require('../controllers/expert.controller')
const {
    acceptEvent,
    updateEvent,
    declineEvent,
    createEventByExpert,
    cancelInvitation,
    createFeedback,
} = require('../controllers/event.controller')
const { filterSeminars } = require('../controllers/customer.controller')

router.post(
    "/updateDailyTimeSlots",
    expertAuth(false),
    updateDailyTimeSlots
);

router.post(
    "/getDailyTimeSlots",
    requireAuth(false),
    getDailyTimeSlots
);

router.post(
    "/updateTimeSlots",
    expertAuth(false),
    updateTimeSlots
);

router.post(
    "/acceptEvent",
    expertAuth(true),
    acceptEvent
);

router.post(
    "/updateEvent",
    expertAuth(true),
    updateEvent
);

router.post(
    "/declineEvent",
    expertAuth(false),
    declineEvent
);

router.post(
    "/cancelInvitation",
    expertAuth(false),
    cancelInvitation
);

router.post(
    "/filterCustomers",
    expertAuth(false),
    filterCustomers
);

router.get("/getUser/:id",expertAuth(false),getCustomerById)

router.post("/createEvent", expertAuth(true), createEventByExpert);

router.post("/createEventFeedback", expertAuth(true), createFeedback);

router.post("/shareMeetingViaEmail", expertAuth(true), shareMeetingViaEmail);

router.post("/getMyPaymentHistory", expertAuth(false), getMyPaymentHistory);

router.post("/filterSeminars", expertAuth(false), filterSeminars);

module.exports = router;
