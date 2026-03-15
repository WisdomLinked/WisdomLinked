const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
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
        return user;
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

    return user;
}

// Build the base URL for OAuth callbacks (handles nginx SSL termination)
const OAUTH_BASE = process.env.FE_URL
    ? process.env.FE_URL.replace(/\/$/, '').replace(/:\d+$/, '').replace('http://', 'https://') 
    : '';

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
                const user = await findOrCreateOAuthUser(profile, 'google');
                done(null, user);
            } catch (err) {
                done(err, null);
            }
        }
    ));
}

// ── Facebook Strategy ───────────────────────────────────────
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy(
        {
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: OAUTH_BASE ? `${OAUTH_BASE}/api/auth/facebook/callback` : '/api/auth/facebook/callback',
            profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: Function) => {
            try {
                const user = await findOrCreateOAuthUser(profile, 'facebook');
                done(null, user);
            } catch (err) {
                done(err, null);
            }
        }
    ));
}

// ── Twitter / X Strategy ────────────────────────────────────
if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET) {
    passport.use(new TwitterStrategy(
        {
            consumerKey: process.env.TWITTER_CONSUMER_KEY,
            consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
            callbackURL: OAUTH_BASE ? `${OAUTH_BASE}/api/auth/twitter/callback` : '/api/auth/twitter/callback',
            includeEmail: true,
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: Function) => {
            try {
                const user = await findOrCreateOAuthUser(profile, 'twitter');
                done(null, user);
            } catch (err) {
                done(err, null);
            }
        }
    ));
}

// Serialize / Deserialize (we use JWT so these are minimal)
passport.serializeUser((user: any, done: Function) => done(null, user._id));
passport.deserializeUser(async (id: string, done: Function) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
