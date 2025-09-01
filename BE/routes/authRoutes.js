const express = require("express");
const router = express.Router();


const {
    login,
    register,
    updateMissedChats,
    updateProfile,
    getKeywordsAndServices,
    handleSubmit,
    leaveFeedback,
    getMe,
    resendConfirmEmail,
    verifyRegistration,
    confirmLoginByCode,
    passwordResetRequest,
    confirmPasswordResetByCode,
    updateResume,
    uploadChatFile,
    healthCheck,
    getTimeZone,
    submitContactForm,
    sendEmailToAdmin

} = require("../controllers/auth.controller");
const { requireAuth } = require("../middlewares/requireAuth");
const {
    validateLoginSchema,
    validateRegisterSchema
} = require("../middlewares/validator")
const {
    getEventsBetweenCustomerAndExpert,
    getMyEvents
} = require('../controllers/event.controller')
const { uploads } = require("../middlewares/multerConfig");
const {
    stripePay,
    createStripePaymentIntent,
    getStripeMode
} = require('../controllers/stripe.controller')

const {
    getChatBotAnswer
} = require('../controllers/chatBotQA.controller')

router.post("/register", uploads, register);
router.post("/updateResume", uploads, updateResume);
router.post("/uploadChatFile", uploads, uploadChatFile);
router.post("/resendConfirmEmail", resendConfirmEmail);
router.post("/verifyRegistration", verifyRegistration);
router.post("/login", validateLoginSchema, login);
router.post("/confirmLoginByCode", confirmLoginByCode);
router.post("/passwordResetRequest", passwordResetRequest);
router.post("/confirmPasswordResetByCode", confirmPasswordResetByCode);
router.get("/getKeywordsAndServices", getKeywordsAndServices);
router.post("/updateMissedChats", requireAuth(false), updateMissedChats);
router.post("/updateProfile", requireAuth(false), updateProfile);
router.post("/getEventsBetweenCustomerAndExpert", requireAuth(false), getEventsBetweenCustomerAndExpert);
router.get("/me", requireAuth(false), getMe);
router.get("/getMyEvents", requireAuth(false), getMyEvents);
router.post("/submit", uploads, handleSubmit)
router.post("/leaveFeedback", requireAuth(false), leaveFeedback)
router.post("/stripePay", requireAuth(false), stripePay)
router.post("/createStripePaymentIntent", requireAuth(false), createStripePaymentIntent)
router.post("/getStripeMode", requireAuth(false), getStripeMode)
router.get("/healthCheck", healthCheck)
router.get("/getTimezone",getTimeZone)
router.post("/contact-form", submitContactForm)
router.post("/sendEmailToAdmin", sendEmailToAdmin)
router.post("/getChatBotAnswer",requireAuth(true),getChatBotAnswer)
// Note: stripe-webhook is now handled directly in server.js before JSON parsing
module.exports = router;
