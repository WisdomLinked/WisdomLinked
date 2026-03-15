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

// ── OAuth Routes ──────────────────────────────────────────
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { updateActiveRoomsOfUsers } = require('../socket/activeRooms');

const oauthCallback = async (req: any, res: any) => {
    try {
        const user = req.user;
        if (!user) return res.redirect(`${process.env.FE_URL}/login?error=auth_failed`);
        
        const token = jwt.sign(
            { email: user.email.toString() },
            process.env.JWT_SECRET,
            { expiresIn: process.env.COOKIE_EXPIRED_TIME || '24h' }
        );
        user.token = token;
        await user.save();
        
        res.cookie('accessToken', token, {
            maxAge: Number(process.env.COOKIE_EXPIRED_TIME) || 86400000,
            httpOnly: true
        });
        
        updateActiveRoomsOfUsers(user._id.toString(), user.groupChats);
        // Redirect to FE with token so it can bootstrap the session
        res.redirect(`${process.env.FE_URL}/oauth-callback?token=${token}&role=${user.role}`);
    } catch (err) {
        console.error('[OAuth Callback Error]', err);
        res.redirect(`${process.env.FE_URL}/login?error=auth_failed`);
    }
};

// Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login?error=google_failed', session: false }), oauthCallback);

// Facebook
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login?error=facebook_failed', session: false }), oauthCallback);

// Twitter / X
router.get('/twitter', passport.authenticate('twitter'));
router.get('/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login?error=twitter_failed', session: false }), oauthCallback);

module.exports = router;
