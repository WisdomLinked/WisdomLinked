const express = require("express");
const router = express.Router();
const { expertAuth, requireAuth } = require("../middlewares/requireAuth");
const {
    updateTimeSlots,
    getDailyTimeSlots,
    updateDailyTimeSlots,
    filterCustomers,
    getCustomerById,
} = require('../controllers/expert.controller')
const {
    acceptEvent,
    declineEvent,
    createEventByExpert,
    cancelInvitation
} = require('../controllers/event.controller')

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

module.exports = router;
