import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const message = { success: false, message: 'Too many requests, please try again later.' };

/**
 * Ask has its own limiter. It does not call shouldSkipRateLimit and it does
 * not skip NODE_ENV=staging. Twenty requests in 15 minutes from one IP, then 429.
 */
export function createAskLimiter() {
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req: any) => ipKeyGenerator(req.ip),
        message,
    });
}

export const askLimiter = createAskLimiter();

module.exports = { askLimiter, createAskLimiter };
