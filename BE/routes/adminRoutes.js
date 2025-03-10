const express = require("express");
const router = express.Router();
const {
    adminAuth
} = require("../middlewares/requireAuth");
const {
    setStripeMode
} = require("../controllers/stripe.controller");
const { 
    filterUsers, 
    getFullUserDataByEmail, 
    updateProfileOfUser, 
    filterPaymentHistories ,
    getDirectChatHistory,
    getGroupChatHistory,
    getContactedUs,
    toggleActionedStatus,
    sendEmailToUser,
    getPendingLogins,
    getPendingUsers,
    deletePendingLogin,
    deletePendingUser,
    convertPendingUserToUserByAdmin,
    registerUserByAdmin
} = require("../controllers/admin.controller");

const {
    getUserFeedbacks
} = require("../controllers/admin.controller");

const {
    getFeedback
} = require("../controllers/event.controller");

router.post("/setStripeMode", adminAuth, setStripeMode)
router.post("/filterUsers", adminAuth, filterUsers)
router.post("/filterPaymentHistories", adminAuth, filterPaymentHistories)
router.post("/getFullUserDataByEmail", adminAuth, getFullUserDataByEmail)
router.post("/updateProfileOfUser", adminAuth, updateProfileOfUser)
router.post("/getDirectChatHistory", adminAuth, getDirectChatHistory)
router.post("/getGroupChatHistory", adminAuth, getGroupChatHistory)
router.get("/getEventFeedback", adminAuth, getFeedback)
router.post("/getUserFeedbacks", adminAuth, getUserFeedbacks);
router.post("/getContactedUs", adminAuth, getContactedUs);
router.post("/toggleActionedStatus", adminAuth, toggleActionedStatus);
router.post("/sendEmailToUser", adminAuth, sendEmailToUser);
router.get("/getPendingUsers", adminAuth, getPendingUsers);
router.get("/getPendingLogins", adminAuth, getPendingLogins);
router.post("/deletePendingUser", adminAuth, deletePendingUser);
router.post("/deletePendingLogin", adminAuth, deletePendingLogin);
router.post("/convertPendingUserToUserByAdmin", adminAuth, convertPendingUserToUserByAdmin);
router.post("/registerUserByAdmin", adminAuth, registerUserByAdmin);

module.exports = router;
