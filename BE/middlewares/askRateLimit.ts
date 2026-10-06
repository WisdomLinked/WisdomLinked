import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const message = { success: false, message: 'Too many requests, please try again later.' };

/**
 * Ask limiter kept for easy re-enable; skip always (same policy as apiLimiter).
 */
export function createAskLimiter() {
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req: any) => ipKeyGenerator(req.ip),
        skip: () => true,
        message,
    });
}

export const askLimiter = createAskLimiter();

module.exports = { askLimiter, createAskLimiter };
