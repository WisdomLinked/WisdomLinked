const csrf = require("csurf");

const isProd = process.env.NODE_ENV === 'production';

const baseCsrfProtection = csrf({
    cookie: {
        key: '_csrf',
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        path: '/',
    },
});

const MEETING_BEARER_PATHS = new Set([
    '/api/meeting/chat-sync',
    '/api/meeting/heartbeat',
    '/api/meeting/end-call',
    '/api/meeting/delegate-moderator',
    '/api/meeting/revoke-delegate-moderator',
]);

const hasBearerToken = (req: any): boolean => {
    const raw = String(req?.headers?.authorization || '').trim();
    return raw.toLowerCase().startsWith('bearer ') && raw.slice(7).trim().length > 0;
};

const csrfProtection = (req: any, res: any, next: any) => {
    if (MEETING_BEARER_PATHS.has(req.path) && hasBearerToken(req)) {
        return next();
    }
    return baseCsrfProtection(req, res, next);
};

const csrfErrorHandler = (err, req, res, next) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
            status: 'FAIL',
            code: 'EBADCSRFTOKEN',
            error: 'Invalid or missing CSRF token. Please refresh and try again.',
        });
    }
    return next(err);
};

module.exports = { csrfProtection, csrfErrorHandler, MEETING_BEARER_PATHS };
