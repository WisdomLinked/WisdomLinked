const express = require("express");
const router = express.Router();


const {
    login,
    logout,
    register,
    updateMissedChats,
    updateProfile,
    uploadProfilePhoto,
    getKeywordsAndServices,
    handleSubmit,
    leaveFeedback,
    getMe,
    resendConfirmEmail,
    verifyRegistration,
    checkVerificationStatus,
    confirmLoginByCode,
    passwordResetRequest,
    verifyPasswordResetOTP,
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
const { uploadsGeneral, uploadsChatFile, uploadsProfilePhoto } = require("../middlewares/multerConfig");
const { mapChatUploadMulterError } = require("../middlewares/multerConfig");
const {
    stripePay,
    createStripePaymentIntent,
    getStripeMode
} = require('../controllers/stripe.controller')

const {
    getChatBotAnswer
} = require('../controllers/chatBotQA.controller')

router.post("/register", uploadsGeneral, register);
router.post("/updateResume", uploadsGeneral, updateResume);
router.post("/uploadChatFile", (req: any, res: any, next: any) => {
    uploadsChatFile(req, res, (err: any) => {
        if (err) {
            return res.status(400).json({
                status: "FAIL",
                error: mapChatUploadMulterError(err),
            });
        }
        return next();
    });
}, uploadChatFile);
router.post("/resendConfirmEmail", resendConfirmEmail);
router.post("/verifyRegistration", verifyRegistration);
router.get("/checkVerification", checkVerificationStatus);
router.post("/login", validateLoginSchema, login);
router.post("/logout", logout);
router.post("/confirmLoginByCode", confirmLoginByCode);
router.post("/passwordResetRequest", passwordResetRequest);
router.post("/verifyPasswordResetOTP", verifyPasswordResetOTP);
router.post("/confirmPasswordResetByCode", confirmPasswordResetByCode);
router.get("/getKeywordsAndServices", getKeywordsAndServices);
router.post("/updateMissedChats", requireAuth(false), updateMissedChats);
router.post("/updateProfile", requireAuth(false), updateProfile);
router.post("/profilePhoto", requireAuth(false), uploadsProfilePhoto, uploadProfilePhoto);
router.put("/profile", requireAuth(false), uploadsGeneral, updateProfile); // Used by complete profile flow
router.post("/getEventsBetweenCustomerAndExpert", requireAuth(false), getEventsBetweenCustomerAndExpert);
router.get("/me", requireAuth(false), getMe);
router.get("/getMyEvents", requireAuth(false), getMyEvents);
router.post("/submit", uploadsGeneral, handleSubmit)
router.post("/leaveFeedback", requireAuth(false), leaveFeedback)
router.post("/stripePay", requireAuth(true), stripePay)
router.post("/createStripePaymentIntent", requireAuth(true), createStripePaymentIntent)
router.post("/getStripeMode", requireAuth(true), getStripeMode)
router.get("/healthCheck", healthCheck)
router.get("/getTimezone",getTimeZone)
router.post("/contact-form", submitContactForm)
router.post("/sendEmailToAdmin", sendEmailToAdmin)
router.post("/getChatBotAnswer",requireAuth(false),getChatBotAnswer)
// Note: stripe-webhook is now handled directly in server.js before JSON parsing

// ── OAuth Routes ──────────────────────────────────────────
const passport = require('passport');
const jwt = require('jsonwebtoken');
import { syncUserToRocketChat } from '../services/rocketchat.service';

const oauthCallback = async (req: any, res: any) => {
    try {
        const result = req.user;
        if (!result) return res.redirect(`${process.env.FE_URL}/login?error=auth_failed`);

        // Unpack { user, isNew } from findOrCreateOAuthUser
        const user = result.user || result;
        const isNew = result.isNew || false;

        // Read role + redirect + timezone from OAuth state parameter (Google/Facebook) or session (Twitter)
        const rawState = String(req.query.state || '').trim();
        let role: string | null = (req.session && req.session.oauthRole) || null;
        let redirectPath = '';
        let timezone = '';
        if (rawState) {
            try {
                const parsed = JSON.parse(decodeURIComponent(rawState));
                if (parsed && typeof parsed === 'object') {
                    if (typeof parsed.role === 'string' && parsed.role.trim()) {
                        role = parsed.role.trim();
                    }
                    if (typeof parsed.redirect === 'string' && parsed.redirect.trim()) {
                        redirectPath = parsed.redirect.trim();
                    }
                    if (typeof parsed.timezone === 'string' && parsed.timezone.trim()) {
                        timezone = parsed.timezone.trim();
                    }
                } else {
                    role = rawState;
                }
            } catch {
                // Backward compatibility: old state format used role directly.
                role = rawState;
            }
        }

        // If new user came from login page (no role), block signup and redirect to register
        if (isNew && (!role || (role !== 'expert' && role !== 'customer'))) {
            // Delete the auto-created user since they should register first
            const User = require('../models/User');
            await User.findByIdAndDelete(user._id);
            return res.redirect(`${process.env.FE_URL}/login?error=no_account`);
        }

        // Set role for NEW users from registration pages only
        if (isNew && role && (role === 'expert' || role === 'customer')) {
            user.role = role;
        }

        // Capture the browser timezone only on first-time OAuth signup; never touch it on later logins.
        if (timezone && isNew) {
            user.timeZone = timezone;
        }
        
        // Block existing users from switching roles via OAuth re-registration
        if (!isNew && role && (role === 'expert' || role === 'customer') && user.role !== role) {
            const roleName = user.role === 'customer' ? 'student' : (user.role || 'user');
            return res.redirect(`${process.env.FE_URL}/login?error=role_mismatch&existingRole=${roleName}`);
        }
        
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
        
        // Sync user to Rocket.Chat (fire-and-forget)
        syncUserToRocketChat({
            email: user.email,
            username: user.username,
            name: user.username,
        })
            .then((rcUserId) => {
                if (!rcUserId) {
                    console.warn('RC sync returned no user id (oauth):', user.email);
                }
            })
            .catch(err => console.error('RC sync failed (oauth):', err.message));

        // Check for incomplete profile
        let isProfileIncomplete = false;
        if (!user.keywords || user.keywords.length === 0) isProfileIncomplete = true;
        
        if (user.role === 'customer' || role === 'customer') {
            if (!user.services || user.services.length === 0) isProfileIncomplete = true;
        } else if (user.role === 'expert' || role === 'expert') {
            if (!user.services || user.services.length === 0) isProfileIncomplete = true;
            if (!user.title || user.title.trim() === '') isProfileIncomplete = true;
            if (!user.description || user.description.trim() === '') isProfileIncomplete = true;
        }

        const needsProfile = isNew || isProfileIncomplete;

        // Redirect to FE with token so it can bootstrap the session
        const encodedRedirect = redirectPath.startsWith('/') ? `&redirect=${encodeURIComponent(redirectPath)}` : '';
        const redirectUrl = needsProfile 
            ? `${process.env.FE_URL}/oauth-callback?token=${token}&role=${user.role}&needsProfile=true${encodedRedirect}`
            : `${process.env.FE_URL}/oauth-callback?token=${token}&role=${user.role}${encodedRedirect}`;
        
        res.redirect(redirectUrl);
    } catch (err) {
        console.error('[OAuth Callback Error]', err);
        res.redirect(`${process.env.FE_URL}/login?error=auth_failed`);
    }
};

// Google
router.get('/google', (req: any, res: any, next: any) => {
    const role = req.query.role || 'login';
    const redirectPath = String(req.query.redirect || '').trim();
    const timezone = String(req.query.timezone || '').trim();
    const state = encodeURIComponent(JSON.stringify({
        role,
        redirect: redirectPath.startsWith('/') ? redirectPath : '',
        timezone,
    }));
    passport.authenticate('google', { scope: ['profile', 'email'], state, session: false })(req, res, next);
});
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login?error=google_failed', session: false }), oauthCallback);



module.exports = router;
