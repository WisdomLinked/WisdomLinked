const express = require("express");
const router = express.Router();
const { apiLimiter } = require("../middlewares/rateLimit");
router.use(apiLimiter);
const {
    adminAuth
} = require("../middlewares/requireAuth");
const {
    setStripeMode,
    setSeminarApprovalDeadline,
    setPaymentWindow,
    sendPaymentLinkToUser,
    processRefund,
    sendAdHocPaymentLink
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
    sendWelcomeEmail,
    getDashboardStats,
    getAdminPlatformEvents,
    getPendingLogins,
    getPendingUsers,
    deletePendingLogin,
    deletePendingUser,
    convertPendingUserToUserByAdmin,
    registerUserByAdmin,
    inviteAdmin,
    getCustomMajors,
    consolidateMajors,
    getMajorConsolidations,
    getPaymentIntegrityReport,
    getUserFeedbacks,
    getAllFeedbacks,
    getAuditLogs,
    impersonateUser,
    stopImpersonation,
} = require("../controllers/admin.controller");

const {
    getFeedback
} = require("../controllers/event.controller");

const {
    createChatBotQA,
    getChatBotQA,
    updateChatBotQA,
    deleteChatBotQA
} = require("../controllers/chatBotQA.controller")

const { uploadsGeneral } = require("../middlewares/multerConfig");

router.post("/setStripeMode", adminAuth, setStripeMode)
router.post("/setSeminarApprovalDeadline", adminAuth, setSeminarApprovalDeadline)
router.post("/setPaymentWindow", adminAuth, setPaymentWindow)
router.post("/sendPaymentLinkToUser", adminAuth, sendPaymentLinkToUser)
router.post("/processRefund", adminAuth, processRefund)
router.post("/sendAdHocPaymentLink", adminAuth, sendAdHocPaymentLink)
router.get("/dashboardStats", adminAuth, getDashboardStats)
router.get("/platformEvents", adminAuth, getAdminPlatformEvents)
router.post("/filterUsers", adminAuth, filterUsers)
router.post("/filterPaymentHistories", adminAuth, filterPaymentHistories)
router.post("/getFullUserDataByEmail", adminAuth, getFullUserDataByEmail)
router.post("/updateProfileOfUser", adminAuth, updateProfileOfUser)
router.post("/getDirectChatHistory", adminAuth, getDirectChatHistory)
router.post("/getGroupChatHistory", adminAuth, getGroupChatHistory)
router.get("/getEventFeedback", adminAuth, getFeedback)
router.post("/getUserFeedbacks", adminAuth, getUserFeedbacks);
router.get("/allFeedbacks", adminAuth, getAllFeedbacks);
router.get("/auditLogs", adminAuth, getAuditLogs);
router.post("/impersonate", adminAuth, impersonateUser);
router.post("/stopImpersonation", stopImpersonation);
router.post("/getContactedUs", adminAuth, getContactedUs);
router.post("/toggleActionedStatus", adminAuth, toggleActionedStatus);
router.post("/sendEmailToUser", adminAuth, sendEmailToUser);
router.post("/sendWelcomeEmail", adminAuth, sendWelcomeEmail);
router.get("/getPendingUsers", adminAuth, getPendingUsers);
router.get("/getPendingLogins", adminAuth, getPendingLogins);
router.post("/deletePendingUser", adminAuth, deletePendingUser);
router.post("/deletePendingLogin", adminAuth, deletePendingLogin);
router.post("/convertPendingUserToUserByAdmin", adminAuth, convertPendingUserToUserByAdmin);
router.post("/registerUserByAdmin", adminAuth, uploadsGeneral, registerUserByAdmin);
router.post("/inviteAdmin", adminAuth, inviteAdmin);
router.get("/getCustomMajors", adminAuth, getCustomMajors);
router.post("/consolidateMajors", adminAuth, consolidateMajors);
router.get("/getMajorConsolidations", adminAuth, getMajorConsolidations);
router.get("/paymentIntegrityReport", adminAuth, getPaymentIntegrityReport);
router.post("/createChatBotQA", adminAuth, createChatBotQA)
router.get("/getChatBotQA", adminAuth, getChatBotQA)
router.post("/updateChatBotQA/:id", adminAuth, updateChatBotQA)
router.post("/deleteChatBotQA/:id", adminAuth, deleteChatBotQA)

module.exports = router;
