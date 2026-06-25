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
    confirmEmailChange,
    setOAuthRole,
    updateResume,
    uploadChatFile,
    healthCheck,
    getTimeZone,
    submitContactForm,
    sendEmailToAdmin

} = require("../controllers/auth.controller");
const { requireAuth } = require("../middlewares/requireAuth");
const { authCookieOptions, clearAuthCookieOptions } = require("../config/authCookie");
const { apiLimiter, sensitiveLimiter } = require("../middlewares/rateLimit");
const {
    validateLoginSchema,
    validateRegisterSchema
} = require("../middlewares/validator")
const {
    getEventsBetweenCustomerAndExpert,
    getMyEvents
} = require('../controllers/event.controller')
const { uploadsGeneral, uploadsChatFile, uploadsProfilePhoto, parseMultipartFields } = require("../middlewares/multerConfig");
const { mapChatUploadMulterError } = require("../middlewares/multerConfig");
const {
    stripePay,
    createStripePaymentIntent,
    getStripeMode
} = require('../controllers/stripe.controller')

const {
    getChatBotAnswer
} = require('../controllers/chatBotQA.controller')

router.get("/csrf-token", (req: any, res: any) => res.status(200).json({ csrfToken: req.csrfToken() }));

// Baseline rate limiting for every auth route below.
router.use(apiLimiter);

router.post("/register", sensitiveLimiter, uploadsGeneral, register);
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
router.post("/login", sensitiveLimiter, validateLoginSchema, login);
router.post("/logout", logout);
router.post("/confirmLoginByCode", sensitiveLimiter, confirmLoginByCode);
router.post("/passwordResetRequest", sensitiveLimiter, passwordResetRequest);
router.post("/verifyPasswordResetOTP", sensitiveLimiter, verifyPasswordResetOTP);
router.post("/confirmPasswordResetByCode", sensitiveLimiter, confirmPasswordResetByCode);
router.post("/confirmEmailChange", sensitiveLimiter, confirmEmailChange);
router.get("/getKeywordsAndServices", getKeywordsAndServices);
router.post("/updateMissedChats", requireAuth(false), updateMissedChats);
router.post("/updateProfile", requireAuth(false), updateProfile);
router.post("/profilePhoto", requireAuth(false), uploadsProfilePhoto, uploadProfilePhoto);
router.put("/profile", requireAuth(false), uploadsGeneral, updateProfile); // Used by complete profile flow
router.put("/oauth-role", requireAuth(false), parseMultipartFields, setOAuthRole);
router.post("/getEventsBetweenCustomerAndExpert", requireAuth(false), getEventsBetweenCustomerAndExpert);
router.get("/me", requireAuth(false), getMe);
router.get("/getMyEvents", requireAuth(false), getMyEvents);
router.post("/submit", uploadsGeneral, handleSubmit)
router.post("/leaveFeedback", requireAuth(false), leaveFeedback)
router.post("/stripePay", requireAuth(true), sensitiveLimiter, stripePay)
router.post("/createStripePaymentIntent", requireAuth(true), sensitiveLimiter, createStripePaymentIntent)
router.post("/getStripeMode", requireAuth(true), sensitiveLimiter, getStripeMode)
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

const redirectLoginError = (res: any, code: string, extraParams: Record<string, string> = {}) => {
    res.clearCookie('accessToken', clearAuthCookieOptions());
    const params = new URLSearchParams({ error: code, ...extraParams });
    return res.redirect(`${process.env.FE_URL}/login?${params.toString()}`);
};

const oauthCallback = async (req: any, res: any) => {
    try {
        const result = req.user;
        if (!result) return redirectLoginError(res, 'auth_failed');

        // Unpack { user, isNew } from findOrCreateOAuthUser
        const user = result.user || result;
        const isNew = result.isNew || false;

        const { parseOAuthState, blocksNewUserWithoutRegisterRole } = require('../utils/oauthState');
        const parsedState = parseOAuthState(req.query.state);
        const sessionOAuth = req.session?.wechatOAuth;
        let role: string | null =
            (req.session && req.session.oauthRole) ||
            parsedState.role ||
            (sessionOAuth && sessionOAuth.role) ||
            null;
        let redirectPath = parsedState.redirectPath || String(sessionOAuth?.redirect || '').trim();
        let timezone = parsedState.timezone || String(sessionOAuth?.timezone || '').trim();
        if (req.session?.wechatOAuth) {
            delete req.session.wechatOAuth;
        }

        if (blocksNewUserWithoutRegisterRole(isNew, role, user.oauthProvider)) {
            const User = require('../models/User');
            await User.findByIdAndDelete(user._id);
            return redirectLoginError(res, 'no_account');
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
            return redirectLoginError(res, 'role_mismatch', { existingRole: roleName });
        }
        
        const token = jwt.sign(
            { email: user.email.toString() },
            process.env.JWT_SECRET,
            { expiresIn: process.env.COOKIE_EXPIRED_TIME || '24h' }
        );
        user.token = token;
        await user.save();
        
        res.clearCookie('accessToken', clearAuthCookieOptions());
        res.cookie('accessToken', token, authCookieOptions());
        
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

        // Check for incomplete profile (skip re-onboarding once email + required fields are set).
        const { isOAuthProfileIncomplete, buildOAuthCallbackParams } = require('../services/wechatOAuth');
        const isProfileIncomplete = isOAuthProfileIncomplete(user, role);

        const callbackParams = buildOAuthCallbackParams({
            token,
            userRole: user.role,
            isNew,
            roleFromState: role,
            oauthProvider: user.oauthProvider,
            isProfileIncomplete,
            redirectPath,
        });
        const redirectUrl = `${process.env.FE_URL}/oauth-callback?${callbackParams.toString()}`;
        
        res.redirect(redirectUrl);
    } catch (err) {
        console.error('[OAuth Callback Error]', err);
        return redirectLoginError(res, 'auth_failed');
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

// WeChat (website QR / web login) — not a passport strategy, plain server-side HTTP.
const { buildWeChatAuthUrl, exchangeCodeForUser, findOrCreateWeChatUser, resolveWeChatDefaultRole } = require('../services/wechatOAuth');

router.get('/wechat', (req: any, res: any) => {
    const role = req.query.role || 'login';
    const redirectPath = String(req.query.redirect || '').trim();
    const timezone = String(req.query.timezone || '').trim();
    if (req.session) {
        req.session.wechatOAuth = {
            role,
            redirect: redirectPath.startsWith('/') ? redirectPath : '',
            timezone,
        };
    }
    const state = encodeURIComponent(JSON.stringify({
        role,
        redirect: redirectPath.startsWith('/') ? redirectPath : '',
        timezone,
    }));
    res.redirect(buildWeChatAuthUrl(state));
});

router.get('/wechat/callback', async (req: any, res: any) => {
    try {
        if (req.query.errcode || !req.query.code) {
            return redirectLoginError(res, 'wechat_failed');
        }
        const { parseOAuthState } = require('../utils/oauthState');
        const parsedState = parseOAuthState(req.query.state);
        const sessionOAuth = req.session?.wechatOAuth;
        let role = parsedState.role || sessionOAuth?.role || 'login';
        const defaultRole = resolveWeChatDefaultRole(role);

        const profile = await exchangeCodeForUser(String(req.query.code));
        req.user = await findOrCreateWeChatUser(profile, { defaultRole });
        return oauthCallback(req, res);
    } catch (err) {
        console.error('[WeChat OAuth Callback Error]', err);
        return redirectLoginError(res, 'wechat_failed');
    }
});



module.exports = router;
