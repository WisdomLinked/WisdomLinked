import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Trust the per-route auth middleware to attach the user; fall back to IP.
// ipKeyGenerator normalizes IPv6 so clients can't bypass limits by rotating addresses.
const keyByUserOrIp = (req: any): string => {
    const userId = req?.user?._id || req?.user?.id || req?.userId;
    return userId ? `u:${userId}` : `ip:${ipKeyGenerator(req.ip)}`;
};

const RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED === 'true';

const message = { success: false, message: 'Too many requests, please try again later.' };

/** OAuth browser redirects must not count toward API limits (breaks login after retries). */
function isOAuthAuthRoute(req: { path?: string; originalUrl?: string }): boolean {
    const path = req.path || '';
    if (/^\/(google|wechat)(\/callback)?\/?$/.test(path)) return true;
    const url = req.originalUrl || '';
    return /\/api\/auth\/(google|wechat)(\/callback)?(\?|$)/.test(url);
}

/** CSRF bootstrap must never be rate-limited during login setup. */
function isCsrfTokenRoute(req: { path?: string; method?: string }): boolean {
    const path = req.path || '';
    return req.method === 'GET' && /^\/csrf-token\/?$/.test(path);
}

function isLogoutRoute(req: { path?: string; method?: string }): boolean {
    const path = req.path || '';
    return req.method === 'POST' && /^\/logout\/?$/.test(path);
}

export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 800,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    skip: (req) =>
        RATE_LIMIT_DISABLED ||
        isOAuthAuthRoute(req) ||
        isCsrfTokenRoute(req) ||
        isLogoutRoute(req),
    message,
});

/** Login / OTP — failed attempts (CSRF, bad password) must not burn the cap during QA. */
export const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    skip: () => RATE_LIMIT_DISABLED,
    skipFailedRequests: true,
    message,
});

export const sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 80,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    skip: () => RATE_LIMIT_DISABLED,
    message,
});

module.exports = { apiLimiter, sensitiveLimiter, authLoginLimiter };
