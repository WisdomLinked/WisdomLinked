const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Shared callback: find or create user from OAuth profile
async function findOrCreateOAuthUser(profile: any, provider: string) {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) throw new Error(`No email returned from ${provider}`);

    // Check if user already exists by email
    let user = await User.findOne({ email });
    if (user) {
        // If user exists but didn't have OAuth linked, link it now
        if (!user.oauthProvider) {
            user.oauthProvider = provider;
            user.oauthId = profile.id;
            await user.save();
        }
        return { user, isNew: false };
    }

    // Create new user
    const displayName = profile.displayName || profile.name?.givenName || email.split('@')[0];
    user = new User({
        email,
        username: displayName,
        oauthProvider: provider,
        oauthId: profile.id,
        role: 'customer',
        status: 'review', // OAuth users still need admin approval
    });
    await user.save();

    // Lazy-require to avoid circular dependency at module load
    try {
        const { createGeneralChatAndJoinGlobalChat } = require('../controllers/groupChat.controller');
        await createGeneralChatAndJoinGlobalChat(user._id);
    } catch (e) { console.error('[OAuth] createGeneralChat error:', e.message); }

    try {
        const { sendEmailNewUserAccountApproval } = require('../services/notifications');
        sendEmailNewUserAccountApproval(user.username);
    } catch (e) { console.error('[OAuth] sendEmail error:', e.message); }

    return { user, isNew: true };
}

// Build the base URL for OAuth callbacks (handles nginx SSL termination)
const _feUrl = (process.env.FE_URL || '').replace(/\/$/, '');
const _isLocal = _feUrl.includes('localhost') || _feUrl.includes('127.0.0.1');
const OAUTH_BASE = _isLocal
    ? _feUrl   // keep http:// and port for local dev
    : _feUrl.replace(/:\d+$/, '').replace('http://', 'https://');  // force https for prod/staging

// ── Google Strategy ─────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: OAUTH_BASE ? `${OAUTH_BASE}/api/auth/google/callback` : '/api/auth/google/callback',
            proxy: true,
            scope: ['profile', 'email'],
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: Function) => {
            try {
                const result = await findOrCreateOAuthUser(profile, 'google');
                done(null, result);
            } catch (err) {
                done(err, null);
            }
        }
    ));
}



// Serialize / Deserialize (we use JWT so these are minimal)
passport.serializeUser((result: any, done: Function) => {
    const user = result.user || result;
    done(null, user._id);
});
passport.deserializeUser(async (id: string, done: Function) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
