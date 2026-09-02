const csrf = require("csurf");

const isProd = process.env.NODE_ENV === 'production';

const csrfProtection = csrf({
    cookie: {
        key: '_csrf',
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        path: '/',
    },
});

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

module.exports = { csrfProtection, csrfErrorHandler };
