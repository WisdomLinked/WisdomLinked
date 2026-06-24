const isProd = process.env.NODE_ENV === 'production';

const defaultMaxAge = () => Number(process.env.COOKIE_EXPIRED_TIME) || 86400000;

const baseAuthCookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
};

const authCookieOptions = (maxAge?: number) => ({
    ...baseAuthCookieOptions,
    maxAge: typeof maxAge === 'number' ? maxAge : defaultMaxAge(),
});

const clearAuthCookieOptions = () => ({ ...baseAuthCookieOptions });

module.exports = { authCookieOptions, clearAuthCookieOptions };
