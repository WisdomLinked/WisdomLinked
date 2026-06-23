import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Trust the per-route auth middleware to attach the user; fall back to IP.
// ipKeyGenerator normalizes IPv6 so clients can't bypass limits by rotating addresses.
const keyByUserOrIp = (req: any): string => {
    const userId = req?.user?._id || req?.user?.id || req?.userId;
    return userId ? `u:${userId}` : `ip:${ipKeyGenerator(req.ip)}`;
};

const RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED === 'true';

const message = { success: false, message: 'Too many requests, please try again later.' };

export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    skip: () => RATE_LIMIT_DISABLED,
    message,
});


export const sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    skip: () => RATE_LIMIT_DISABLED,
    message,
});

module.exports = { apiLimiter, sensitiveLimiter };
